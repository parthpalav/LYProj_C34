"""
classifier/train_v4.py
----------------------
Fine-tunes an encoder (--base, default BAAI/bge-small-en-v1.5) on the LLM corpus plus the
human-written train split of dataset.csv (repeated HUMAN_WEIGHT times), with ONE joint label per
(category, type) pair (see category_map.JOINT_LABELS), then:
  - fits a softmax temperature on the validation set (calibration), and
  - picks the needsReview threshold so auto-accepted predictions are >= 95% precise on val.

Checkpoints every SAVE_STEPS; re-running the same command resumes from the last one
(--fresh starts over).

Run (after classifier.generate_llm_dataset):
    cd ml-service && python3 -m classifier.train_v4 --base BAAI/bge-base-en-v1.5
    python3 -m classifier.train_v4 --ensemble finaura-v5-bge-base-en-v1.5 finaura-v5-bge-large-en-v1.5
v4 was trained with: --tag v4 --epochs 10 (writes models/finaura-v4-bge-small-en-v1.5).
Outputs:
    models/finaura-<tag>-<base>/  (HF model + tokenizer + v4_meta.json)
    models/active_model.json      (--ensemble: members + review threshold used by HybridClassifier)
"""

import os
import json
import glob
import argparse
import logging

import numpy as np
import pandas as pd
import torch
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from classifier.category_map import ALLOWED_TYPES, JOINT_LABELS
from classifier.normalize import clean_text

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
TARGET_PRECISION = 0.95
HUMAN_WEIGHT = 3  # human rows are fewer but cleaner than LLM rows
SAVE_STEPS = 200  # also the most work lost if the run is interrupted
LR_BY_SIZE = {"small": 1e-4, "base": 5e-5, "large": 3e-5}

label2id = {l: i for i, l in enumerate(JOINT_LABELS)}
id2label = {i: l for l, i in label2id.items()}
CATS = sorted({l.split("|")[0] for l in JOINT_LABELS})
LABEL_CAT_IDX = np.array([CATS.index(l.split("|")[0]) for l in JOINT_LABELS])


def load_split(name: str, tag: str = "v5") -> pd.DataFrame:
    df = pd.read_csv(os.path.join(DATA_DIR, f"{tag}_{name}.csv")).dropna(subset=["text", "category", "type"])
    # Corpora written before a rubric change (e.g. Education|Investment) keep their rows under the category's default type
    df["type"] = [t if t in ALLOWED_TYPES.get(c, [t]) else ALLOWED_TYPES[c][0] for c, t in zip(df["category"], df["type"])]
    df["label"] = (df["category"] + "|" + df["type"]).map(label2id)
    bad = df["label"].isna().sum()
    if bad:
        log.warning(f"{name}: dropping {bad} rows with invalid (category, type) pairs")
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)
    df["clean"] = df["text"].astype(str).map(clean_text)
    return df[df["clean"] != ""]


def to_dataset(df: pd.DataFrame, tokenizer) -> Dataset:
    ds = Dataset.from_pandas(df[["clean", "label"]].reset_index(drop=True))
    return ds.map(lambda b: tokenizer(b["clean"], truncation=True, max_length=48), batched=True, remove_columns=["clean"])


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def fit_temperature(logits: np.ndarray, labels: np.ndarray) -> float:
    best_t, best_nll = 1.0, float("inf")
    for t in np.linspace(0.5, 4.0, 36):
        p = softmax(logits / t)
        nll = -np.log(p[np.arange(len(labels)), labels] + 1e-12).mean()
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return best_t


def pick_threshold(probs: np.ndarray, labels: np.ndarray) -> float:
    """Lowest confidence cut whose auto-accepted set is >= TARGET_PRECISION correct (joint label)."""
    conf = probs.max(1)
    correct = probs.argmax(1) == labels
    for t in np.round(np.arange(0.30, 0.99, 0.01), 2):
        mask = conf >= t
        if mask.sum() >= 20 and correct[mask].mean() >= TARGET_PRECISION:
            return float(t)
    return 0.99


def compute_metrics(pred):
    preds = pred.predictions.argmax(-1)
    cats_true = LABEL_CAT_IDX[pred.label_ids]
    cats_pred = LABEL_CAT_IDX[preds]
    return {
        "joint_accuracy": accuracy_score(pred.label_ids, preds),
        "category_accuracy": accuracy_score(cats_true, cats_pred),
        "category_macro_f1": f1_score(cats_true, cats_pred, average="macro"),
    }


def ensemble(members: list[str], tag: str):
    """Average the members' calibrated val probs, pick one review threshold, activate the ensemble."""
    from classifier.hybrid_pipeline import HybridClassifier

    val_df = load_split("val", tag)
    clf = HybridClassifier(BASE_DIR)
    assert clf.load_v4(members), f"could not load {members}"
    assert clf.v4_meta["labels"] == JOINT_LABELS, "members use older labels: run python3 -m evaluation.tune_review --activate instead"
    probs = np.stack([clf._classify_v4_probs(t) for t in val_df["clean"]])
    labels = val_df["label"].values
    threshold = pick_threshold(probs, labels)
    acc = float((probs.argmax(1) == labels).mean())
    coverage = float((probs.max(1) >= threshold).mean())
    with open(os.path.join(MODELS_DIR, "active_model.json"), "w") as f:
        json.dump({"members": members, "review_threshold": threshold, "val_joint_accuracy": acc,
                   "val_auto_accept_coverage": coverage}, f, indent=2)
    print(f"Ensemble {members}: val joint {acc:.1%} | threshold {threshold:.2f} | coverage {coverage:.1%}")
    print(f"[SAVED] {os.path.join(MODELS_DIR, 'active_model.json')}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="v5", help="data/<tag>_*.csv to train on")
    ap.add_argument("--base", default="BAAI/bge-small-en-v1.5")
    ap.add_argument("--epochs", type=float, default=6)
    ap.add_argument("--lr", type=float, help="default by model size: small 1e-4, base 5e-5, large 3e-5")
    ap.add_argument("--fresh", action="store_true", help="ignore existing checkpoints and start over")
    ap.add_argument("--ensemble", nargs="+", metavar="MODEL_DIR", help="activate these trained dirs as an ensemble")
    args = ap.parse_args()
    if args.ensemble:
        return ensemble(args.ensemble, args.tag)

    short = args.base.split("/")[-1]
    size = next((k for k in LR_BY_SIZE if k in short), "base")
    model_out = os.path.join(MODELS_DIR, f"finaura-{args.tag}-{short}")
    ckpt_dir = os.path.join(MODELS_DIR, f"checkpoints-{args.tag}-{short}")
    resume = not args.fresh and bool(glob.glob(os.path.join(ckpt_dir, "checkpoint-*")))

    train_df, val_df = load_split("train", args.tag), load_split("val", args.tag)
    train_df = pd.concat([train_df] + [load_split("human_train", args.tag)] * HUMAN_WEIGHT, ignore_index=True)
    print(f"Loaded {len(train_df):,} train / {len(val_df):,} val rows, {len(JOINT_LABELS)} joint labels | "
          f"{args.base} | {'resuming from ' + ckpt_dir if resume else 'fresh start'}")

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base, num_labels=len(JOINT_LABELS), id2label=id2label, label2id=label2id
    )
    train_ds, val_ds = to_dataset(train_df, tokenizer), to_dataset(val_df, tokenizer)

    batch, accum = (32, 2) if size == "large" else (64, 1)  # large: same effective batch, fits 16 GB
    args_tr = TrainingArguments(
        output_dir=ckpt_dir,
        eval_strategy="steps",
        eval_steps=SAVE_STEPS,
        save_strategy="steps",
        save_steps=SAVE_STEPS,
        save_total_limit=1,
        learning_rate=args.lr or LR_BY_SIZE[size],
        per_device_train_batch_size=batch,
        gradient_accumulation_steps=accum,
        per_device_eval_batch_size=128,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        warmup_steps=30,
        load_best_model_at_end=True,
        metric_for_best_model="joint_accuracy",
        logging_steps=50,
        report_to="none",
        seed=42,
    )
    trainer = Trainer(
        model=model, args=args_tr, train_dataset=train_ds, eval_dataset=val_ds,
        data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=compute_metrics,
    )
    trainer.train(resume_from_checkpoint=True if resume else None)

    out = trainer.predict(val_ds)
    logits, labels = out.predictions, out.label_ids
    temperature = fit_temperature(logits, labels)
    probs = softmax(logits / temperature)
    threshold = pick_threshold(probs, labels)
    coverage = float((probs.max(1) >= threshold).mean())
    print(f"\nVal metrics: {out.metrics}")
    print(f"Temperature: {temperature:.2f} | review threshold: {threshold:.2f} | auto-accept coverage: {coverage:.1%}")

    os.makedirs(model_out, exist_ok=True)
    trainer.save_model(model_out)
    tokenizer.save_pretrained(model_out)
    with open(os.path.join(model_out, "v4_meta.json"), "w") as f:
        json.dump({
            "base_model": args.base,
            "data_tag": args.tag,
            "labels": JOINT_LABELS,
            "temperature": temperature,
            "review_threshold": threshold,
            "target_precision": TARGET_PRECISION,
            "val_metrics": {k: float(v) for k, v in out.metrics.items() if isinstance(v, (int, float))},
            "val_auto_accept_coverage": coverage,
        }, f, indent=2)
    print(f"[SAVED] {model_out}")


if __name__ == "__main__":
    main()
