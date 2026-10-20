"""
classifier/train_v4.py
----------------------
Fine-tunes BAAI/bge-small-en-v1.5 on the v4 LLM corpus plus the human-written
train split of dataset.csv (repeated HUMAN_WEIGHT times), with ONE joint label per
(category, type) pair (see category_map.JOINT_LABELS), then:
  - fits a softmax temperature on the validation set (calibration), and
  - picks the needsReview threshold so auto-accepted predictions are >= 95% precise on val.

Run (after classifier.generate_llm_dataset):
    cd ml-service && python3 -m classifier.train_v4
Outputs:
    models/finaura-v4/  (HF model + tokenizer + v4_meta.json)
"""

import os
import json
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

from classifier.category_map import JOINT_LABELS
from classifier.normalize import clean_text

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_OUT = os.path.join(BASE_DIR, "models", "finaura-v4")
BASE_MODEL = "BAAI/bge-small-en-v1.5"
TARGET_PRECISION = 0.95
HUMAN_WEIGHT = 3  # human rows are fewer but cleaner than LLM rows

label2id = {l: i for i, l in enumerate(JOINT_LABELS)}
id2label = {i: l for l, i in label2id.items()}
CATS = sorted({l.split("|")[0] for l in JOINT_LABELS})
LABEL_CAT_IDX = np.array([CATS.index(l.split("|")[0]) for l in JOINT_LABELS])


def load_split(name: str) -> pd.DataFrame:
    df = pd.read_csv(os.path.join(DATA_DIR, f"v4_{name}.csv")).dropna(subset=["text", "category", "type"])
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


def main():
    train_df, val_df = load_split("train"), load_split("val")
    train_df = pd.concat([train_df] + [load_split("human_train")] * HUMAN_WEIGHT, ignore_index=True)
    print(f"Loaded {len(train_df):,} train / {len(val_df):,} val rows, {len(JOINT_LABELS)} joint labels")

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=len(JOINT_LABELS), id2label=id2label, label2id=label2id
    )
    train_ds, val_ds = to_dataset(train_df, tokenizer), to_dataset(val_df, tokenizer)

    args = TrainingArguments(
        output_dir=os.path.join(BASE_DIR, "models", "checkpoints-v4"),
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=1,
        learning_rate=1e-4,
        per_device_train_batch_size=64,
        per_device_eval_batch_size=128,
        num_train_epochs=10,
        weight_decay=0.01,
        warmup_steps=30,
        load_best_model_at_end=True,
        metric_for_best_model="joint_accuracy",
        logging_steps=50,
        report_to="none",
        seed=42,
    )
    trainer = Trainer(
        model=model, args=args, train_dataset=train_ds, eval_dataset=val_ds,
        data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=compute_metrics,
    )
    trainer.train()

    out = trainer.predict(val_ds)
    logits, labels = out.predictions, out.label_ids
    temperature = fit_temperature(logits, labels)
    probs = softmax(logits / temperature)
    threshold = pick_threshold(probs, labels)
    coverage = float((probs.max(1) >= threshold).mean())
    print(f"\nVal metrics: {out.metrics}")
    print(f"Temperature: {temperature:.2f} | review threshold: {threshold:.2f} | auto-accept coverage: {coverage:.1%}")

    os.makedirs(MODEL_OUT, exist_ok=True)
    trainer.save_model(MODEL_OUT)
    tokenizer.save_pretrained(MODEL_OUT)
    with open(os.path.join(MODEL_OUT, "v4_meta.json"), "w") as f:
        json.dump({
            "base_model": BASE_MODEL,
            "labels": JOINT_LABELS,
            "temperature": temperature,
            "review_threshold": threshold,
            "target_precision": TARGET_PRECISION,
            "val_metrics": {k: float(v) for k, v in out.metrics.items() if isinstance(v, (int, float))},
            "val_auto_accept_coverage": coverage,
        }, f, indent=2)
    print(f"[SAVED] {MODEL_OUT}")


if __name__ == "__main__":
    main()
