"""
evaluation/tune_review.py
-------------------------
When should the app ask the user to confirm a model guess? HybridClassifier asks when the joint
(category, type) confidence is below the review threshold. train_v4 picks that threshold for 95%
precision on its synthetic val split, which proved stricter than needed (~99% precision on human rows).

For each member set (one model, or an ensemble whose probabilities are averaged) and each target precision:
  threshold  <- picked on synthetic val rows whose merchant/phrase no member saw in training
  scored on  -> human held-out (rubric labels) and the challenge set, through the full pipeline (rules + model)

Run:
    cd ml-service && python3 -m evaluation.tune_review
    # switch the app to a row of the report (members + target precision):
    python3 -m evaluation.tune_review --sets finaura-v5-bge-base-en-v1.5,finaura-v6-bge-base-en-v1.5 --activate 0.90
Outputs:
    ../research/results/review_threshold.{json,md}
"""

import os
import json
import logging
import argparse

import numpy as np
import pandas as pd

from classifier.hybrid_pipeline import HybridClassifier
from classifier.category_map import ALLOWED_TYPES
from classifier.normalize import clean_text

logging.disable(logging.INFO)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE_DIR, "data")
MODELS = os.path.join(BASE_DIR, "models")
RESULTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "research", "results")
DEFAULT_SETS = ["finaura-v5-bge-base-en-v1.5", "finaura-v6-bge-base-en-v1.5",
                "finaura-v5-bge-base-en-v1.5,finaura-v6-bge-base-en-v1.5"]
MIN_ACCEPTED = 20


def rubric_type(category: str, spend_type: str) -> str:
    """Labels written before a rubric change (e.g. Education|Investment) map to the category's default type."""
    return spend_type if spend_type in ALLOWED_TYPES.get(category, [spend_type]) else ALLOWED_TYPES[category][0]


def trained_items(tag: str) -> set:
    """Lexicon texts behind a corpus's train split. Split ids index that corpus's own lexicon, so compare by text."""
    lex = pd.read_csv(os.path.join(DATA, f"{tag}_lexicon.csv"))["text"].str.lower().tolist()
    items = set()
    for mid in pd.read_csv(os.path.join(DATA, f"{tag}_train.csv"))["merchant"].unique():
        _, _, key = str(mid).partition(":")
        items.add(lex[int(key)].lower() if key.isdigit() else str(mid).lower())
    return items


def unseen_val(tags: list) -> pd.DataFrame:
    seen = set().union(*(trained_items(t) for t in tags))
    parts = []
    for t in tags:
        lex = pd.read_csv(os.path.join(DATA, f"{t}_lexicon.csv"))["text"].str.lower().tolist()
        v = pd.read_csv(os.path.join(DATA, f"{t}_val.csv"))
        item = v["merchant"].map(lambda m: lex[int(m.split(":")[1])] if m.split(":")[1].isdigit() else m.lower())
        parts.append(v[~item.isin(seen)])
    return pd.concat(parts).drop_duplicates("text").reset_index(drop=True)


def pick_threshold(conf: np.ndarray, correct: np.ndarray, target: float) -> float:
    """Lowest cut whose auto-accepted set is >= target correct (same search as train_v4)."""
    for t in np.round(np.arange(0.30, 0.99, 0.01), 2):
        mask = conf >= t
        if mask.sum() >= MIN_ACCEPTED and correct[mask].mean() >= target:
            return float(t)
    return 0.99


def pipeline_preds(clf: HybridClassifier, df: pd.DataFrame) -> list:
    out = []
    for text, cat, ty in zip(df["text"].astype(str), df["category"], df["type"]):
        r = clf.classify(text)
        out.append({
            "ok": r["category"] == cat and r["type"] == rubric_type(cat, ty),
            "rule": r["classificationSource"] == "merchant_rule",
            "conf": float(r.get("typeConfidence", 0.0)),  # joint confidence on the finaura_v4 path
        })
    return out


def score(preds: list, threshold: float) -> dict:
    ok = np.array([p["ok"] for p in preds])
    auto = np.array([p["rule"] or p["conf"] >= threshold for p in preds])
    return {"joint_accuracy": float(ok.mean()), "auto_accept_coverage": float(auto.mean()),
            "auto_accept_precision": float(ok[auto].mean()) if auto.any() else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets", nargs="+", default=DEFAULT_SETS, help="member sets, each a comma-separated list of model dirs")
    ap.add_argument("--targets", nargs="+", type=float, default=[0.95, 0.92, 0.90, 0.88, 0.85])
    ap.add_argument("--activate", type=float, metavar="TARGET", help="write models/active_model.json for --sets[0] at this target")
    args = ap.parse_args()

    human_held = pd.read_csv(os.path.join(DATA, "v4_human_test.csv"))["text"]
    human = pd.read_csv(os.path.join(DATA, "human_labels.csv"))
    eval_sets = {
        "human_held_out": human[human["text"].isin(human_held)].reset_index(drop=True),
        "challenge": pd.read_csv(os.path.join(BASE_DIR, "evaluation", "challenge_v4.csv")),
    }

    results = {}
    for spec in args.sets[:1] if args.activate else args.sets:
        members = spec.split(",")
        tags = sorted({json.load(open(os.path.join(MODELS, m, "v4_meta.json")))["data_tag"] for m in members})
        clf = HybridClassifier(BASE_DIR)
        if not clf.load_v4(members):
            raise SystemExit(f"could not load {members}")
        val = unseen_val(tags)
        val_pred = [clf._classify_v4(clean_text(t) or t.lower()) for t in val["text"].astype(str)]
        val_conf = np.array([p[3] for p in val_pred])
        val_ok = np.array([(p[0], p[1]) == (c, rubric_type(c, ty)) for p, c, ty in zip(val_pred, val["category"], val["type"])])
        preds = {name: pipeline_preds(clf, df) for name, df in eval_sets.items()}
        print(f"{spec}: {len(val)} unseen val rows, val joint accuracy {val_ok.mean():.1%}")

        if args.activate:
            threshold = pick_threshold(val_conf, val_ok, args.activate)
            active = {"members": members, "review_threshold": threshold, "target_precision": args.activate,
                      "val_joint_accuracy": float(val_ok.mean()),
                      "val_auto_accept_coverage": float((val_conf >= threshold).mean())}
            with open(os.path.join(MODELS, "active_model.json"), "w") as f:
                json.dump(active, f, indent=2)
            print(f"[SAVED] models/active_model.json: {active}")
            return

        rows = []
        for target in args.targets:
            threshold = pick_threshold(val_conf, val_ok, target)
            rows.append({"target_precision": target, "threshold": threshold,
                         **{name: score(p, threshold) for name, p in preds.items()}})
        results[spec] = {"val_rows": len(val), "val_joint_accuracy": float(val_ok.mean()), "rows": rows}

    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, "review_threshold.json"), "w") as f:
        json.dump(results, f, indent=2)
    pct = lambda x: "—" if x is None else f"{x * 100:.1f}%"
    lines = ["# Review threshold and ensemble tuning", "",
             "Threshold picked on synthetic val rows no member trained on; scored through rules + model.",
             "Coverage = share accepted without asking the user; precision = share of those that are right.", ""]
    for spec, res in results.items():
        lines += [f"## {spec}", "", f"val rows: {res['val_rows']}, val joint accuracy {pct(res['val_joint_accuracy'])}", "",
                  "| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |",
                  "|---|---|---|---|---|---|---|---|"]
        for r in res["rows"]:
            h, c = r["human_held_out"], r["challenge"]
            lines.append(f"| {r['target_precision']:.2f} | {r['threshold']:.2f} | {pct(h['joint_accuracy'])} | {pct(h['auto_accept_coverage'])} | "
                         f"{pct(h['auto_accept_precision'])} | {pct(c['joint_accuracy'])} | {pct(c['auto_accept_coverage'])} | {pct(c['auto_accept_precision'])} |")
        lines.append("")
    report = "\n".join(lines)
    with open(os.path.join(RESULTS_DIR, "review_threshold.md"), "w") as f:
        f.write(report)
    print(report)


if __name__ == "__main__":
    main()
