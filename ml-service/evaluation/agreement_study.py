"""
evaluation/agreement_study.py
-----------------------------
How far do LLMs from different families agree when labelling Indian expenses, and how close is
each of them to people?

Inputs (from: python3 -m classifier.generate_llm_dataset --tag agreement --model qwen2.5:7b
               --verifiers llama3.1:8b,qwen2.5:7b,mistral:7b,gemma2:9b):
  data/<tag>_lexicon_raw.csv                    generator lexicon; row index = item number in the caches
  data/<tag>_lexicon/verify__<model>__*.json    each verifier's blind (category, type) per lexicon item
  data/human_labels.csv                         human-written rows with rubric-reviewed labels

The human rows are labelled by every model with the same blind prompt the verifiers used
(cached as data/<tag>_lexicon/human__<model>__<start>.json, resumable), then the study reports:
  1. lexicon: each verifier's agreement with the generator's intended label (category / type / joint)
  2. lexicon: self-consistency, i.e. the generator re-labelling its own items blind, vs other families
  3. lexicon: pairwise Cohen's kappa on category, and Fleiss' kappa across all verifiers
  4. lexicon: items kept by the strict-majority vote as verifiers are added, and per-category disagreement
  5. lexicon: the most frequent category confusions (generator category -> verifier category)
  6. human rows: each model's and the majority vote's accuracy against people

Run (Ollama serving the models):
    cd ml-service && python3 -m evaluation.agreement_study
Outputs:
    ../research/results/llm_agreement_study.{json,md}
"""

import os
import re
import glob
import json
import argparse
from itertools import combinations

import numpy as np
import pandas as pd
from sklearn.metrics import cohen_kappa_score, f1_score

from classifier.generate_llm_dataset import DATA_DIR, VERIFY_BATCH, label_batch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_DIR = os.path.join(os.path.dirname(BASE_DIR), "research", "results")
GENERATOR = "generator"


def slug(model: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", model.lower())


def read_labels(paths: list[str], n: int) -> pd.DataFrame:
    """Cached batch files -> DataFrame(category, type) indexed by item number; NaN where a model gave no label."""
    out = pd.DataFrame(index=range(n), columns=["category", "type"], dtype=object)
    for path in paths:
        start = int(re.search(r"__(\d+)\.json$", path).group(1))
        for lab in json.load(open(path)):
            i = int(lab.get("i", -1))
            if start <= i < min(start + VERIFY_BATCH, n):  # same guard as verify_lexicon
                out.loc[i] = [lab.get("category"), lab.get("type")]
    return out


def label_human(human: pd.DataFrame, model: str, cache_dir: str) -> tuple[pd.DataFrame, int]:
    failed = 0
    for start in range(0, len(human), VERIFY_BATCH):
        path = os.path.join(cache_dir, f"human__{slug(model)}__{start:05d}.json")
        if os.path.exists(path):
            continue
        print(f"[HUMAN {model}] rows {start}-{min(start + VERIFY_BATCH, len(human)) - 1} of {len(human)} ...", flush=True)
        try:
            labels = label_batch(human.iloc[start:start + VERIFY_BATCH], model)
        except Exception as e:  # rerun retries only the missing batches
            print(f"   ! failed: {e}")
            failed += 1
            continue
        json.dump(labels, open(path, "w"), indent=1)
    paths = glob.glob(os.path.join(cache_dir, f"human__{slug(model)}__*.json"))
    return read_labels(paths, len(human)), failed


def agreement(a: pd.DataFrame, b: pd.DataFrame) -> dict:
    both = a["category"].notna() & b["category"].notna()
    a, b = a[both], b[both]
    cat = a["category"] == b["category"]
    return {
        "n": int(both.sum()),
        "category": float(cat.mean()),
        "type": float((a["type"] == b["type"]).mean()),
        "joint": float((cat & (a["type"] == b["type"])).mean()),
        "category_kappa": float(cohen_kappa_score(a["category"], b["category"])),
    }


def fleiss_kappa(cats: pd.DataFrame) -> float:
    """cats: one column per rater, rows = items every rater labelled."""
    stacked = cats.stack()
    counts = pd.crosstab(stacked.index.get_level_values(0), stacked.values).to_numpy()
    k = cats.shape[1]
    p_j = counts.sum(0) / counts.sum()
    p_i = ((counts ** 2).sum(1) - k) / (k * (k - 1))
    p_e = (p_j ** 2).sum()
    return float((p_i.mean() - p_e) / (1 - p_e))


def majority(cats: pd.DataFrame) -> pd.Series:
    """Strict-majority category per row (NaN when no category has more than half the votes)."""
    def vote(row):
        counts = row.dropna().value_counts()
        return counts.index[0] if len(counts) and counts.iloc[0] * 2 > len(row) else np.nan
    return cats.apply(vote, axis=1)


def lexicon_study(lex: pd.DataFrame, labels: dict[str, pd.DataFrame], verifiers: list[str], gen_model: str) -> dict:
    gen = labels[GENERATOR]
    res = {"n_items": len(lex), "generator": gen_model, "verifiers": verifiers}

    res["vs_generator"] = {m: agreement(gen, labels[m]) for m in verifiers}
    others = [m for m in verifiers if m != gen_model]
    if gen_model in verifiers and others:
        res["self_consistency"] = {
            "generator_relabelling_itself": res["vs_generator"][gen_model]["category"],
            "other_families_mean": float(np.mean([res["vs_generator"][m]["category"] for m in others])),
        }

    raters = [GENERATOR] + verifiers
    res["pairwise_category_kappa"] = {f"{a} vs {b}":agreement(labels[a], labels[b])["category_kappa"]
                                      for a, b in combinations(raters, 2)}
    cats = pd.DataFrame({m: labels[m]["category"] for m in raters})
    complete = cats.dropna()
    res["fleiss_kappa_verifiers"] = fleiss_kappa(complete[verifiers])
    res["fleiss_kappa_all_raters"] = fleiss_kappa(complete)
    res["n_items_labelled_by_all"] = len(complete)

    # Same rule as verify_lexicon: generator + verifiers vote, strict majority on the category.
    res["keep_rate_by_verifiers"] = {}
    for k in range(1, len(verifiers) + 1):
        vote = majority(cats[[GENERATOR] + verifiers[:k]])
        res["keep_rate_by_verifiers"][", ".join(verifiers[:k])] = {
            "kept": float(vote.notna().mean()),
            "kept_but_relabelled": float((vote.notna() & (vote != cats[GENERATOR])).mean()),
        }

    vote = majority(cats)
    unanimous = cats.nunique(axis=1, dropna=False).eq(1)
    per_cat = {}
    for c, idx in lex.groupby("category").groups.items():
        per_cat[c] = {
            "n": len(idx),
            "unanimous": float(unanimous[idx].mean()),
            "majority_agrees_with_generator": float((vote[idx] == c).mean()),
            "dropped_no_majority": float(vote[idx].isna().mean()),
        }
    res["per_category"] = dict(sorted(per_cat.items(), key=lambda kv: kv[1]["unanimous"]))

    pairs = pd.concat([pd.DataFrame({"from": cats[GENERATOR], "to": cats[m]}) for m in verifiers]).dropna()
    pairs = pairs[pairs["from"] != pairs["to"]]
    top = pairs.value_counts().head(15)
    res["top_confusions"] = [{"generator": f, "verifier": t, "count": int(n)} for (f, t), n in top.items()]
    return res


def human_study(human: pd.DataFrame, labels: dict[str, pd.DataFrame], models: list[str]) -> dict:
    res = {"n_rows": len(human), "models": {}}
    for m in models:
        lab = labels[m]
        got = lab["category"].notna()
        cat = lab["category"] == human["category"]
        typ = lab["type"] == human["type"]
        res["models"][m] = {
            "labelled": float(got.mean()),
            "category_accuracy": float(cat.mean()),
            "category_macro_f1": float(f1_score(human.loc[got, "category"], lab.loc[got, "category"], average="macro")),
            "type_accuracy": float(typ.mean()),
            "joint_accuracy": float((cat & typ).mean()),
        }
    vote = majority(pd.DataFrame({m: labels[m]["category"] for m in models}))
    decided = vote.notna()
    res["majority_vote"] = {
        "coverage": float(decided.mean()),
        "category_accuracy_when_decided": float((vote[decided] == human.loc[decided, "category"]).mean()),
        "category_accuracy_overall": float((vote == human["category"]).mean()),
    }
    per_cat = {}
    for c, idx in human.groupby("category").groups.items():
        per_cat[c] = {"n": len(idx), **{m: float((labels[m].loc[idx, "category"] == c).mean()) for m in models}}
    res["per_category_accuracy"] = per_cat
    return res


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def report(lexicon: dict, human: dict) -> str:
    gen, verifiers = lexicon["generator"], lexicon["verifiers"]
    lines = ["# LLM labelling agreement study", "",
             f"Generator: `{gen}`, {lexicon['n_items']:,} lexicon items (merchants + spend phrases, 14 categories).",
             f"Blind verifiers: {', '.join(f'`{m}`' for m in verifiers)}. Labels follow data/CATEGORY_RUBRIC.md.", "",
             "## 1. Verifier agreement with the generator's intended label", "",
             "| verifier | n | category | type | joint | category kappa |", "|---|---|---|---|---|---|"]
    for m, a in lexicon["vs_generator"].items():
        lines.append(f"| {m} | {a['n']:,} | {pct(a['category'])} | {pct(a['type'])} | {pct(a['joint'])} | {a['category_kappa']:.3f} |")
    if "self_consistency" in lexicon:
        s = lexicon["self_consistency"]
        lines += ["", "## 2. Self-consistency", "",
                  f"`{gen}` re-labelling its own items blind agrees on the category {pct(s['generator_relabelling_itself'])} "
                  f"of the time; the other families agree with it {pct(s['other_families_mean'])} on average."]
    lines += ["", "## 3. Inter-rater reliability (category)", "",
              f"Fleiss' kappa across verifiers: **{lexicon['fleiss_kappa_verifiers']:.3f}**; across all raters "
              f"including the generator: **{lexicon['fleiss_kappa_all_raters']:.3f}** "
              f"(n = {lexicon['n_items_labelled_by_all']:,} items labelled by every rater).", "",
              "| rater pair | Cohen's kappa |", "|---|---|"]
    lines += [f"| {p} | {k:.3f} |" for p, k in lexicon["pairwise_category_kappa"].items()]
    lines += ["", "## 4. Majority-vote filtering", "",
              "Each item is kept only when a strict majority of the generator plus verifiers agree on its category.", "",
              "| verifiers | kept | kept but relabelled |", "|---|---|---|"]
    for v, r in lexicon["keep_rate_by_verifiers"].items():
        lines.append(f"| {v} | {pct(r['kept'])} | {pct(r['kept_but_relabelled'])} |")
    lines += ["", "Per category (all raters), least unanimous first:", "",
              "| category | n | unanimous | majority = generator | dropped |", "|---|---|---|---|---|"]
    for c, r in lexicon["per_category"].items():
        lines.append(f"| {c} | {r['n']:,} | {pct(r['unanimous'])} | {pct(r['majority_agrees_with_generator'])} | "
                     f"{pct(r['dropped_no_majority'])} |")
    lines += ["", "## 5. Most frequent category confusions", "", "| generator said | verifier said | count |", "|---|---|---|"]
    lines += [f"| {c['generator']} | {c['verifier']} | {c['count']:,} |" for c in lexicon["top_confusions"]]

    models = list(human["models"])
    lines += ["", f"## 6. Agreement with people ({human['n_rows']} human-written rows, rubric labels)", "",
              "| model | category acc | category macro-F1 | type acc | joint acc |", "|---|---|---|---|---|"]
    for m, r in human["models"].items():
        lines.append(f"| {m} | {pct(r['category_accuracy'])} | {pct(r['category_macro_f1'])} | "
                     f"{pct(r['type_accuracy'])} | {pct(r['joint_accuracy'])} |")
    mv = human["majority_vote"]
    lines += ["", f"Majority vote of all {len(models)} models decides {pct(mv['coverage'])} of rows, "
                  f"{pct(mv['category_accuracy_when_decided'])} correct when it decides "
                  f"({pct(mv['category_accuracy_overall'])} over all rows).", "",
              "Per-category accuracy:", "", "| category | n | " + " | ".join(models) + " |",
              "|---" * (len(models) + 2) + "|"]
    for c, r in human["per_category_accuracy"].items():
        lines.append(f"| {c} | {r['n']} | " + " | ".join(pct(r[m]) for m in models) + " |")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="agreement", help="data/<tag>_lexicon_raw.csv and data/<tag>_lexicon/")
    ap.add_argument("--generator", default="qwen2.5:7b")
    ap.add_argument("--verifiers", default="llama3.1:8b,qwen2.5:7b,mistral:7b,gemma2:9b")
    args = ap.parse_args()
    verifiers = [m for m in args.verifiers.split(",") if m]
    models = list(dict.fromkeys([args.generator] + verifiers))
    cache_dir = os.path.join(DATA_DIR, f"{args.tag}_lexicon")

    lex = pd.read_csv(os.path.join(DATA_DIR, f"{args.tag}_lexicon_raw.csv"))
    labels = {GENERATOR: lex[["category", "type"]].astype(object)}
    for m in verifiers:
        paths = glob.glob(os.path.join(cache_dir, f"verify__{slug(m)}__*.json"))
        if not paths:
            raise SystemExit(f"no verifier labels for {m}: run classifier.generate_llm_dataset with it first")
        labels[m] = read_labels(paths, len(lex))

    human = pd.read_csv(os.path.join(DATA_DIR, "human_labels.csv"))
    human_labels, failed = {}, 0
    for m in models:
        human_labels[m], f = label_human(human, m, cache_dir)
        failed += f
    if failed:
        raise SystemExit(f"{failed} human-row batches failed; re-run the same command to retry only those")

    results = {"lexicon": lexicon_study(lex, labels, verifiers, args.generator),
               "human": human_study(human, human_labels, models)}
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, "llm_agreement_study.json"), "w") as f:
        json.dump(results, f, indent=2)
    md = report(results["lexicon"], results["human"])
    with open(os.path.join(RESULTS_DIR, "llm_agreement_study.md"), "w") as f:
        f.write(md)
    print(md)


if __name__ == "__main__":
    main()
