"""
evaluation/evaluate_v4.py
-------------------------
Legacy pipeline (rules -> TF-IDF category + MiniLM type head) vs v4 (rules -> finaura-v4) vs v5
(rules -> models/active_model.json ensemble, when present) on:
  a) data/v5_test.csv (else v4_test.csv) — synthetic, merchants unseen in that corpus's training
     (v4 may have seen some v5 test merchants in its own training split, which favours v4)
  b) 140 held-out human-written rows of dataset.csv (same rows for every model), labelled by
     data/CATEGORY_RUBRIC.md (data/human_labels.csv); for a fair comparison the legacy TF-IDF is
     retrained on the same 80% split
  b0) the same 140 rows with their original labels (dataset.csv category + LLM type, as v4 was scored)
  c) evaluation/challenge_v4.csv — hand-written adversarial set (UPI/POS strings, Hinglish, ambiguity)
  d) evaluation/real_transactions.csv (text,category,type), if present — real statements, never trained on

Note: both pipelines share the current (tightened) rules.py, so the gap shown is the model gap.

Run:
    cd ml-service && python3 -m evaluation.evaluate_v4
Outputs:
    ../research/results/classifier_v5_eval.{json,md}
    (--candidate DIR: ../research/results/classifier_<its data tag>_eval.{json,md})
"""

import os
import json
import time
import argparse
import logging

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score

from classifier.hybrid_pipeline import HybridClassifier

logging.disable(logging.CRITICAL)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "research", "results")

DATA = os.path.join(BASE_DIR, "data")


def load_sets() -> dict:
    a = os.path.join(DATA, "v5_test.csv")
    held = pd.read_csv(os.path.join(DATA, "v4_human_test.csv"))
    rubric = pd.read_csv(os.path.join(DATA, "human_labels.csv"))
    sets = {
        "a_synthetic_unseen_merchants": pd.read_csv(a if os.path.exists(a) else os.path.join(DATA, "v4_test.csv")),
        "b_human_held_out_rubric": rubric[rubric["text"].isin(held["text"])].reset_index(drop=True),
        "b0_human_held_out_original_labels": held,
        "c_challenge_adversarial": pd.read_csv(os.path.join(BASE_DIR, "evaluation", "challenge_v4.csv")),
    }
    real = os.path.join(BASE_DIR, "evaluation", "real_transactions.csv")
    if os.path.exists(real):
        sets["d_real_transactions"] = pd.read_csv(real)
    return sets


def legacy_pipeline(retrain_on_human_split: bool = False) -> HybridClassifier:
    clf = HybridClassifier(BASE_DIR)
    clf._v4_checked = True  # never load v4: forces the TF-IDF + MiniLM type path
    if retrain_on_human_split:
        # Production TF-IDF was fit on all of dataset.csv; refit on the 80% split (same settings as
        # train_classifier.py) so set (b) is unseen for both pipelines.
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from classifier.hybrid_pipeline import clean_tfidf_text

        train = pd.read_csv(os.path.join(BASE_DIR, "data", "v4_human_train.csv"))
        clf.load_category()
        clf.category_vectorizer = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
        X = clf.category_vectorizer.fit_transform(train["text"].astype(str).map(clean_tfidf_text))
        clf.category_model = LogisticRegression(max_iter=500, solver="lbfgs", C=5.0, class_weight="balanced").fit(X, train["category"])
    return clf


def evaluate(clf: HybridClassifier, df: pd.DataFrame) -> dict:
    preds, latencies = [], []
    for text in df["text"].astype(str):
        t0 = time.perf_counter()
        preds.append(clf.classify(text))
        latencies.append((time.perf_counter() - t0) * 1000)
    cat_pred = [p["category"] for p in preds]
    auto = np.array([not p["needsReview"] for p in preds])
    cat_ok = np.array(cat_pred) == df["category"].values
    out = {
        "n": len(df),
        "category_accuracy": accuracy_score(df["category"], cat_pred),
        "category_macro_f1": f1_score(df["category"], cat_pred, average="macro", zero_division=0),
        "auto_accept_coverage": float(auto.mean()),
        "p50_latency_ms": float(np.median(latencies)),
        "rule_share": float(np.mean([p["classificationSource"] == "merchant_rule" for p in preds])),
    }
    ok = cat_ok
    if "type" in df.columns:
        type_ok = np.array([p["type"] for p in preds]) == df["type"].values
        ok = cat_ok & type_ok
        out["type_accuracy"] = float(type_ok.mean())
        out["joint_accuracy"] = float(ok.mean())
    out["auto_accept_precision"] = float(ok[auto].mean()) if auto.any() else None
    out["errors"] = [
        {"text": t, "expected": f"{c}|{ty}", "got": f"{p['category']}|{p['type']}", "source": p["classificationSource"]}
        for t, c, ty, p, good in zip(df["text"], df["category"], df.get("type", [""] * len(df)), preds, ok) if not good
    ][:40]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", metavar="MODEL_DIR", help="also score this trained model dir (e.g. finaura-v6-bge-base-en-v1.5) "
                    "as column 'candidate'; the report is then written as classifier_<tag>_eval")
    args = ap.parse_args()
    pipelines = {"legacy": legacy_pipeline(), "v4": HybridClassifier(BASE_DIR)}
    if not pipelines["v4"].load_v4(["finaura-v4"]):
        raise SystemExit("models/finaura-v4 missing: run python3 -m classifier.train_v4 first")
    if os.path.exists(os.path.join(BASE_DIR, "models", "active_model.json")):
        pipelines["v5"] = HybridClassifier(BASE_DIR)
        pipelines["v5"].load_v4()
    out_name = "classifier_v5_eval"
    if args.candidate:
        pipelines["candidate"] = HybridClassifier(BASE_DIR)
        if not pipelines["candidate"].load_v4([args.candidate]):
            raise SystemExit(f"models/{args.candidate} failed to load")
        out_name = f"classifier_{json.load(open(os.path.join(BASE_DIR, 'models', args.candidate, 'v4_meta.json')))['data_tag']}_eval"
    names = list(pipelines)

    results = {}
    for set_name, df in load_sets().items():
        runs = dict(pipelines, legacy=legacy_pipeline(True)) if set_name.startswith("b") else pipelines
        results[set_name] = {name: evaluate(clf, df) for name, clf in runs.items()}

    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, f"{out_name}.json"), "w") as f:
        json.dump(results, f, indent=2)

    metrics = ["category_accuracy", "category_macro_f1", "type_accuracy", "joint_accuracy",
               "auto_accept_coverage", "auto_accept_precision", "rule_share", "p50_latency_ms"]
    members = json.load(open(os.path.join(BASE_DIR, "models", "active_model.json")))["members"] if "v5" in names else []
    lines = ["# Classifier v5 evaluation", "",
             "Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4."
             + (f" v5 = rules + ensemble {members}." if members else "")
             + (f" candidate = rules + {args.candidate}." if args.candidate else ""),
             "All share the current rules.py. On sets b/b0 the legacy TF-IDF is refit on the same 80% human split.", ""]
    best = names[-1]
    for set_name, res in results.items():
        lines += [f"## {set_name} (n={res[best]['n']})", "", "| metric | " + " | ".join(names) + " |",
                  "|---" * (len(names) + 1) + "|"]
        for m in metrics:
            vals = [res[n].get(m) for n in names]
            if all(v is None for v in vals):
                continue
            fmt = (lambda x: f"{x:.1f}") if m == "p50_latency_ms" else (lambda x: "—" if x is None else f"{x * 100:.1f}%")
            lines.append(f"| {m} | " + " | ".join(fmt(v) for v in vals) + " |")
        lines += ["", f"{best} errors (first 40):", ""]
        lines += [f"- `{e['text']}` expected {e['expected']}, got {e['got']} ({e['source']})" for e in res[best]["errors"]]
        lines.append("")
    report = "\n".join(lines)
    with open(os.path.join(RESULTS_DIR, f"{out_name}.md"), "w") as f:
        f.write(report)
    print(report)


if __name__ == "__main__":
    main()
