"""
classifier/claude_labels.py
---------------------------
Claude subagents as blind verifiers for classifier.generate_llm_dataset. Verifier names that start
with "claude" are read from data/<tag>_lexicon/verify__<who>.json only; this script fills that cache.

  export    items of data/<tag>_lexicon_raw.csv that <who> has not labelled -> DIR/batch_<k>.tsv (i<TAB>text)
  disputes  items where --against (claude-sonnet) disagrees with the generator on category or type,
            not yet labelled by <who> (claude-opus) -> DIR/batch_<k>.tsv, the text only (blind)
  merge     subagent replies DIR/batch_<k>.out.tsv (i<TAB>CODE<TAB>T) -> verify__<who>.json + coverage report

CODE is a two-letter category code from CODES (XX = not a plausible expense, dropped by the vote); T is N, W or I.

Run:
    cd ml-service && python3 -m classifier.claude_labels export --tag v7 --who claude-sonnet --out DIR
    python3 -m classifier.claude_labels merge --tag v7 --who claude-sonnet DIR
    python3 -m classifier.claude_labels disputes --tag v7 --who claude-opus --out DIR2
"""

import os
import glob
import json
import argparse

import pandas as pd

from classifier.category_map import ALLOWED_TYPES

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

CODES = {
    "FD": "Food & Dining", "GR": "Groceries", "TT": "Transport & Travel", "HO": "Housing",
    "UB": "Utilities & Bills", "DL": "Debt & Loan Payments", "SH": "Shopping", "EN": "Entertainment",
    "HE": "Health", "ED": "Education", "PC": "Personal Care", "IN": "Insurance", "IV": "Investments", "MI": "Misc",
    "XX": "XX",
}
TYPES = {"N": "Need", "W": "Want", "I": "Investment"}


def parse_reply(lines: list[str]) -> tuple[dict, int]:
    """i<TAB>CODE<TAB>T lines -> {i: {"category", "type"}}, plus the count of unparseable lines."""
    labels, bad = {}, 0
    for line in lines:
        parts = line.strip().split("\t")
        if not parts[0]:
            continue
        if len(parts) < 2 or not parts[0].isdigit() or parts[1].upper() not in CODES:
            bad += 1
            continue
        category = CODES[parts[1].upper()]
        spend_type = TYPES.get(parts[2].strip().upper()[:1]) if len(parts) > 2 else None
        if category != "XX" and spend_type not in ALLOWED_TYPES[category]:
            spend_type = ALLOWED_TYPES[category][0]  # type invalid for the category: use the rubric default
        labels[int(parts[0])] = {"category": category, "type": spend_type}
    return labels, bad


def _cache_path(tag: str, who: str) -> str:
    return os.path.join(DATA_DIR, f"{tag}_lexicon", f"verify__{who}.json")


def _load(tag: str, who: str) -> tuple[pd.DataFrame, dict]:
    path = _cache_path(tag, who)
    return pd.read_csv(os.path.join(DATA_DIR, f"{tag}_lexicon_raw.csv")), json.load(open(path)) if os.path.exists(path) else {}


def write_batches(items: pd.DataFrame, out: str, size: int):
    os.makedirs(out, exist_ok=True)
    items = items.sample(frac=1.0, random_state=42)  # lexicon order groups by category, which would hint the label
    for k, start in enumerate(range(0, len(items), size)):
        part = items.iloc[start:start + size]
        with open(os.path.join(out, f"batch_{k:02d}.tsv"), "w") as f:
            f.writelines(f"{i}\t{t}\n" for i, t in zip(part.index, part["text"]))
    print(f"[EXPORT] {len(items)} items -> {(len(items) + size - 1) // size} batches in {out}")


def export(tag: str, who: str, out: str, size: int):
    lex, cache = _load(tag, who)
    write_batches(lex[~lex["text"].isin(cache)], out, size)


def disputes(tag: str, who: str, against: str, out: str, size: int, only: list[str]):
    lex, cache = _load(tag, who)
    ref = json.load(open(_cache_path(tag, against)))
    lab = lex["text"].map(ref)
    differs = pd.Series([isinstance(v, dict) and (v["category"], v["type"]) != (c, t)
                         for v, c, t in zip(lab, lex["category"], lex["type"])], index=lex.index)
    todo = lex[differs & ~lex["text"].isin(cache)]
    if only:  # cap: adjudicate only disputes that touch these categories
        theirs = todo["text"].map(lambda t: ref[t]["category"])
        todo = todo[todo["category"].isin(only) | theirs.isin(only)]
    print(todo.assign(theirs=todo["text"].map(lambda t: ref[t]["category"]))
          .groupby(["category", "theirs"]).size().sort_values(ascending=False).head(15).to_string())
    write_batches(todo, out, size)


def merge(tag: str, who: str, src: str):
    lex, cache = _load(tag, who)
    asked = missing = bad = 0
    for path in sorted(glob.glob(os.path.join(src, "batch_*.tsv"))):
        if path.endswith(".out.tsv"):
            continue
        sent = {int(i): t for i, t in (line.rstrip("\n").split("\t", 1) for line in open(path) if line.strip())}
        reply = path[:-4] + ".out.tsv"
        labels, b = parse_reply(open(reply).readlines()) if os.path.exists(reply) else ({}, 0)
        asked, bad = asked + len(sent), bad + b
        missing += len(set(sent) - set(labels))
        for i, lab in labels.items():
            if i in sent:  # map ids through the batch that was sent, so later lexicon rebuilds cannot shift them
                cache[sent[i]] = lab
    json.dump(cache, open(_cache_path(tag, who), "w"), indent=1, ensure_ascii=False)
    print(f"[MERGE] {who}: asked {asked}, missing {missing}, unparseable lines {bad}, cache now {len(cache)}")
    lab = lex["text"].map(cache)
    done = lex[lab.notna()].assign(cat=lab.dropna().map(lambda v: v["category"]),
                                   typ=lab.dropna().map(lambda v: v["type"]))
    if len(done):
        done = done.assign(cat_ok=done["cat"] == done["category"], joint_ok=(done["cat"] == done["category"]) & (done["typ"] == done["type"]))
        print(f"agreement with generator: category {done['cat_ok'].mean():.1%}, joint {done['joint_ok'].mean():.1%}, "
              f"XX {(done['cat'] == 'XX').mean():.1%} over {len(done)} items")
        print(done.groupby("category")[["cat_ok", "joint_ok"]].mean().round(3).to_string())
    print(f"unlabelled lexicon items left: {int(lab.isna().sum())}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["export", "disputes", "merge"])
    ap.add_argument("src", nargs="?", help="merge: the directory holding batch_*.tsv and batch_*.out.tsv")
    ap.add_argument("--tag", default="v7")
    ap.add_argument("--who", default="claude-sonnet", help="verifier cache to fill (verify__<who>.json)")
    ap.add_argument("--against", default="claude-sonnet", help="disputes: verifier compared with the generator")
    ap.add_argument("--out", help="export/disputes: directory for the batches")
    ap.add_argument("--size", type=int, default=1700, help="items per batch")
    ap.add_argument("--only", nargs="*", default=[], help="disputes: keep only these categories")
    args = ap.parse_args()
    if args.cmd == "export":
        export(args.tag, args.who, args.out, args.size)
    elif args.cmd == "disputes":
        disputes(args.tag, args.who, args.against, args.out, args.size, args.only)
    else:
        merge(args.tag, args.who, args.src)


if __name__ == "__main__":
    main()
