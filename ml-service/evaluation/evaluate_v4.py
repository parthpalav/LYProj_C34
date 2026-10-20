"""
evaluation/evaluate_v4.py
-------------------------
Legacy pipeline (rules -> TF-IDF category + MiniLM type head) vs v4 pipeline
(rules -> finaura-v4 joint model) on three sets:
  a) data/v4_test.csv          — synthetic, merchants unseen in training
  b) data/v4_human_test.csv    — 140 human-written rows of dataset.csv, held out exactly like
                                 benchmarks/run_v3_acceptance_audit.py; for a fair comparison the
                                 legacy TF-IDF is retrained on the same 80% split
  c) evaluation/challenge_v4.csv — hand-written adversarial set (UPI/POS strings, Hinglish, ambiguity)

Note: both pipelines share the current (tightened) rules.py, so the gap shown is the model gap.

Run:
    cd ml-service && python3 -m evaluation.evaluate_v4
Outputs:
    ../research/results/classifier_v4_eval.{json,md}
"""

import os
import json
import time
import logging

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score

from classifier.hybrid_pipeline import HybridClassifier

logging.disable(logging.CRITICAL)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "research", "results")

SETS = {
    "a_v4_test_unseen_merchants": os.path.join(BASE_DIR, "data", "v4_test.csv"),
    "b_human_held_out": os.path.join(BASE_DIR, "data", "v4_human_test.csv"),
    "c_challenge_adversarial": os.path.join(BASE_DIR, "evaluation", "challenge_v4.csv"),
}


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
    pipelines = {"legacy": legacy_pipeline(), "v4": HybridClassifier(BASE_DIR)}
    if not pipelines["v4"].load_v4():
        raise SystemExit("models/finaura-v4 missing: run python3 -m classifier.train_v4 first")

    results = {}
    for set_name, path in SETS.items():
        df = pd.read_csv(path)
        if "expected_category" in df.columns:
            df = df.rename(columns={"expected_category": "category", "expected_type": "type"})
        runs = dict(pipelines, legacy=legacy_pipeline(True)) if set_name.startswith("b_") else pipelines
        results[set_name] = {name: evaluate(clf, df) for name, clf in runs.items()}

    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, "classifier_v4_eval.json"), "w") as f:
        json.dump(results, f, indent=2)

    metrics = ["category_accuracy", "category_macro_f1", "type_accuracy", "joint_accuracy",
               "auto_accept_coverage", "auto_accept_precision", "rule_share", "p50_latency_ms"]
    lines = ["# Classifier v4 evaluation", "", "Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4 joint model.",
             "Both share the current rules.py. On set b the legacy TF-IDF is refit on the same 80% human split.", ""]
    for set_name, res in results.items():
        lines += [f"## {set_name} (n={res['v4']['n']})", "", "| metric | legacy | v4 |", "|---|---|---|"]
        for m in metrics:
            lv, vv = res["legacy"].get(m), res["v4"].get(m)
            if lv is None and vv is None:
                continue
            fmt = (lambda x: f"{x:.1f}") if m == "p50_latency_ms" else (lambda x: "—" if x is None else f"{x * 100:.1f}%")
            lines.append(f"| {m} | {fmt(lv)} | {fmt(vv)} |")
        lines += ["", "v4 errors (first 40):", ""]
        lines += [f"- `{e['text']}` expected {e['expected']}, got {e['got']} ({e['source']})" for e in res["v4"]["errors"]]
        lines.append("")
    report = "\n".join(lines)
    with open(os.path.join(RESULTS_DIR, "classifier_v4_eval.md"), "w") as f:
        f.write(report)
    print(report)


if __name__ == "__main__":
    main()
