"""
classifier/generate_llm_dataset.py
----------------------------------
Builds the v4 training corpus with a local LLM (Ollama, default qwen2.5:7b).

Stage 1 (LLM, resumable): per category, generate Indian merchants and natural
spend phrases (incl. Hinglish), each labelled Need / Want / Investment.
Cached under data/v4_lexicon/<category>__<kind>__<batch>.json.

Stage 1b (LLM, resumable): blind verification. The LLM re-labels every item
against the full taxonomy without seeing the intended category; only items whose
category agrees are kept; if generator and verifier disagree on type, the
category's default type is used. Removes category drift.

Stage 2 (script): expand every lexicon item into the input styles users actually
produce (bare merchant, merchant + amount, UPI / POS / bank strings, sentences,
typos), then split 80/10/10 by merchant so test merchants are never seen in training.

Run:
    ollama serve &  &&  ollama pull qwen2.5:7b
    cd ml-service && python3 -m classifier.generate_llm_dataset
Stage 3 (LLM, resumable): add Need/Want/Investment types to the human-written
dataset.csv (it only has categories) and split it 80/20 exactly like
benchmarks/run_v3_acceptance_audit.py (stratified, random_state=42).

Outputs:
    data/v4_train.csv, data/v4_val.csv, data/v4_test.csv
    data/v4_human_train.csv, data/v4_human_test.csv
"""

import os
import re
import json
import random
import argparse
import urllib.request

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from classifier.category_map import FINAURA_CATEGORIES, ALLOWED_TYPES
from classifier.exp2_generate_data import generate_amount, add_noise

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LEXICON_DIR = os.path.join(DATA_DIR, "v4_lexicon")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")

CATEGORY_GUIDE = {
    "Food & Dining": "restaurants, cafes, dhabas, food delivery, street food, sweet shops, office canteen, tiffin/mess. Want by default; Need ONLY for hostel mess, tiffin service or office canteen.",
    "Groceries": "kirana stores, supermarkets, quick-commerce grocery apps, vegetables, milk, staples, household supplies. Need; Want only for treats like chocolates or imported snacks.",
    "Transport & Travel": "fuel, metro, bus, train, auto, tolls, parking, cabs, flights, hotels, holidays. Need ONLY for commute, fuel, tolls, parking, metro/bus/local train; flights, hotels, cabs, vacations and holidays are always Want.",
    "Housing": "rent, society maintenance, property tax, home repairs, plumber, electrician, maid/cook salary. Always Need.",
    "Utilities & Bills": "electricity, water, gas cylinder, piped gas, broadband, mobile recharge, DTH. Always Need.",
    "Debt & Loan Payments": "loan EMIs, credit card bill payments, BNPL/pay-later dues, NBFC loan apps. Always Need.",
    "Shopping": "clothes, footwear, electronics, gadgets, furniture, home decor, gifts, e-commerce orders, jewellery. Want mostly; Need for essentials like school uniform or a work laptop repair.",
    "Entertainment": "OTT subscriptions, movies, concerts, gaming, pubs, bars, alcohol, cigarettes, events, amusement parks. Always Want.",
    "Health": "pharmacies, hospitals, doctors, diagnostics, dentists, medicines. Need; Want for gym, fitness classes, supplements, protein powder.",
    "Education": "school/college fees, coaching, online courses, books, exam fees, certifications. Investment for skill-building/courses/degrees; Need for school fees, school van, stationery for kids.",
    "Personal Care": "salons, barbers, spa, cosmetics, skincare, grooming products. Want; Need for basic toiletries like toothpaste, soap, sanitary pads.",
    "Insurance": "health, life, term, motor, travel insurance premiums and insurers. Always Need.",
    "Investments": "brokers, mutual funds, SIPs, stocks, ETFs, PPF, NPS, FDs, RDs, gold bonds, digital gold. Always Investment.",
    "Misc": "person-to-person UPI transfers to individuals, cash withdrawal, bank charges, fines/challans, donations, unclear payments. Need for fines/bank charges/transfers to family; Want for donations or tips.",
}

ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"text": {"type": "string"}, "type": {"type": "string", "enum": ["Need", "Want", "Investment"]}},
                "required": ["text", "type"],
            },
        }
    },
    "required": ["items"],
}

PROMPTS = {
    "merchant": (
        "List {n} distinct real merchants, brands, apps or shop names that people in India pay for "
        "\"{category}\" ({guide}). Focus: {focus}. Give only the merchant/shop name as it would appear on a "
        "bill or UPI screen (1-4 words, no descriptions). Label each with type Need, Want or Investment "
        "following the rule above. Avoid these already-used names: {avoid}. Reply as JSON."
    ),
    "phrase": (
        "Write {n} distinct short descriptions (2-8 words) an Indian user would type into an expense app "
        "for \"{category}\" ({guide}). Focus: {focus}. Mix English, Hinglish (e.g. 'sabzi wala', 'chai sutta', "
        "'doodh'), lowercase and casual typing. Do not include amounts. Label each with type Need, Want or "
        "Investment following the rule above. Reply as JSON."
    ),
}
FOCI = {
    "merchant": [
        "well-known national chains, apps and brands (real names only)",
        "real regional chains and brands from different Indian states and cities (real names only, no invented names)",
        "typical local shop names that include the shop type, like 'Balaji Medical Store', 'Sharma Kirana', 'New Krishna Hair Salon'",
    ],
    "phrase": ["everyday common spends", "less common or specific spends", "Hinglish and very casual short notes"],
}

VERIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "i": {"type": "integer"},
                    "category": {"type": "string", "enum": FINAURA_CATEGORIES},
                    "type": {"type": "string", "enum": ["Need", "Want", "Investment"]},
                },
                "required": ["i", "category", "type"],
            },
        }
    },
    "required": ["labels"],
}
VERIFY_BATCH = 40

STATES = ["MUMBAI", "PUNE", "DELHI", "BANGALORE", "CHENNAI", "HYDERABAD", "KOLKATA", "AHMEDABAD", "JAIPUR", "LUCKNOW", "IN"]
HANDLES = ["okaxis", "oksbi", "okicici", "okhdfcbank", "ybl", "paytm", "ibl", "axl", "upi"]
BANKS = ["SBI", "HDFC", "ICICI", "AXIS", "KOTAK", "YESB"]
SENTENCE_TEMPLATES = ["paid {m}", "{m} payment", "paid to {m}", "{m} bill", "at {m}", "{m} purchase", "spent at {m}", "{m} order"]


def _ollama(prompt: str, model: str, schema: dict = ITEM_SCHEMA, key: str = "items", temperature: float = 0.9) -> list:
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "format": schema,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": 3000},
    }).encode()
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as resp:
        content = json.loads(resp.read())["message"]["content"]
    return json.loads(content).get(key, [])


def build_lexicon(model: str, n: int) -> pd.DataFrame:
    os.makedirs(LEXICON_DIR, exist_ok=True)
    rows = []
    for category in FINAURA_CATEGORIES:
        for kind, foci in FOCI.items():
            seen: set[str] = set()
            for b, focus in enumerate(foci):
                path = os.path.join(LEXICON_DIR, f"{category.replace(' ', '_').replace('&', 'and')}__{kind}__{b}.json")
                if os.path.exists(path):
                    items = json.load(open(path))
                else:
                    prompt = PROMPTS[kind].format(n=n, category=category, guide=CATEGORY_GUIDE[category], focus=focus,
                                                  avoid=", ".join(sorted(seen)[:60]) or "none")
                    print(f"[LLM] {category} / {kind} / {focus} ...", flush=True)
                    try:
                        items = _ollama(prompt, model)
                    except Exception as e:  # keep going; a rerun retries only the missing batches
                        print(f"   ! failed: {e}")
                        continue
                    json.dump(items, open(path, "w"), indent=1, ensure_ascii=False)
                for it in items:
                    text = str(it.get("text", "")).strip()
                    spend_type = it.get("type")
                    if not text or len(text) > 60 or text.lower() in seen or not text.isascii():
                        continue
                    if re.search(r"\b(need|needed|want|investment)\b", text, re.IGNORECASE):
                        continue  # LLM leaked the label into the text
                    if spend_type not in ALLOWED_TYPES[category]:
                        spend_type = ALLOWED_TYPES[category][0]  # LLM picked a type invalid for this category
                    seen.add(text.lower())
                    rows.append({"text": text, "category": category, "type": spend_type, "kind": kind})
    lex = pd.DataFrame(rows)
    # Same string generated under two categories is ambiguous: drop it rather than teach noise.
    dup = lex.assign(k=lex["text"].str.lower()).groupby("k")["category"].nunique()
    lex = lex[~lex["text"].str.lower().isin(dup[dup > 1].index)]
    return lex.reset_index(drop=True)


def verify_lexicon(lex: pd.DataFrame, model: str) -> pd.DataFrame:
    guide = "\n".join(f"- {c}: {g}" for c, g in CATEGORY_GUIDE.items())
    verdicts: dict[int, dict] = {}
    for start in range(0, len(lex), VERIFY_BATCH):
        path = os.path.join(LEXICON_DIR, f"verify__{start:05d}.json")
        chunk = lex.iloc[start:start + VERIFY_BATCH]
        if os.path.exists(path):
            labels = json.load(open(path))
        else:
            items = "\n".join(f"{i}. {t}" for i, t in zip(chunk.index, chunk["text"]))
            prompt = (
                "You label expenses for an Indian personal finance app. Categories and type rules:\n"
                f"{guide}\n\nFor each numbered item below (a merchant name or a short expense note), give its "
                "category and type (Need, Want or Investment) following the rules exactly. Reply as JSON with one "
                f"label for every item, using the item number as i.\n\n{items}"
            )
            print(f"[VERIFY] items {start}-{start + len(chunk) - 1} ...", flush=True)
            try:
                labels = _ollama(prompt, model, VERIFY_SCHEMA, "labels", temperature=0.0)
            except Exception as e:  # rerun retries only the missing batches
                print(f"   ! failed: {e}")
                continue
            json.dump(labels, open(path, "w"), indent=1)
        for lab in labels:
            verdicts[int(lab.get("i", -1))] = lab
    keep = []
    for i, r in lex.iterrows():
        v = verdicts.get(i)
        if not v or v.get("category") != r["category"]:
            continue
        spend_type = r["type"] if v.get("type") == r["type"] else ALLOWED_TYPES[r["category"]][0]
        keep.append({**r.to_dict(), "type": spend_type})
    out = pd.DataFrame(keep)
    print(f"[VERIFY] kept {len(out)}/{len(lex)} items ({len(out) / max(len(lex), 1):.0%} category agreement)")
    return out.reset_index(drop=True)


TYPE_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"i": {"type": "integer"}, "type": {"type": "string", "enum": ["Need", "Want", "Investment"]}},
                "required": ["i", "type"],
            },
        }
    },
    "required": ["labels"],
}


def label_human_types(model: str) -> pd.DataFrame:
    human = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv")).dropna(subset=["text", "category"]).reset_index(drop=True)
    types: dict[int, str] = {}
    for start in range(0, len(human), VERIFY_BATCH):
        path = os.path.join(LEXICON_DIR, f"human_types__{start:05d}.json")
        chunk = human.iloc[start:start + VERIFY_BATCH]
        if os.path.exists(path):
            labels = json.load(open(path))
        else:
            items = "\n".join(f"{i}. [{c}] {t}" for i, t, c in zip(chunk.index, chunk["text"], chunk["category"]))
            prompt = (
                "You label expenses for an Indian personal finance app. Type rules per category:\n"
                + "\n".join(f"- {c}: {g}" for c, g in CATEGORY_GUIDE.items())
                + "\n\nEach numbered item below shows its category in brackets. Give its type (Need, Want or "
                f"Investment) following the rules exactly. Reply as JSON with one label for every item.\n\n{items}"
            )
            print(f"[TYPES] human rows {start}-{start + len(chunk) - 1} ...", flush=True)
            try:
                labels = _ollama(prompt, model, TYPE_SCHEMA, "labels", temperature=0.0)
            except Exception as e:  # rerun retries only the missing batches
                print(f"   ! failed: {e}")
                continue
            json.dump(labels, open(path, "w"), indent=1)
        for lab in labels:
            types[int(lab.get("i", -1))] = lab.get("type")
    human["type"] = [
        types.get(i) if types.get(i) in ALLOWED_TYPES[c] else ALLOWED_TYPES[c][0]
        for i, c in zip(human.index, human["category"])
    ]
    return human


def _ref(n: int) -> str:
    return "".join(random.choice("0123456789") for _ in range(n))


def expand_merchant(m: str) -> list[tuple[str, str]]:
    up = m.upper()
    out = [
        (random.choice([m, m.lower()]), "merchant"),
        (random.choice([f"{m} {generate_amount()}", f"{generate_amount()} {m}"]), "merchant_amount"),
        (random.choice([
            f"UPI/DR/{_ref(12)}/{up}/{random.choice(HANDLES)}",
            f"UPI-{up.replace(' ', '')}-{_ref(6)}@{random.choice(HANDLES)}",
            f"UPI/{_ref(12)}/{up[:20]}/{m.lower().replace(' ', '')}@{random.choice(HANDLES)}/{random.choice(BANKS)}",
        ]), "upi"),
        (random.choice([
            f"POS {_ref(4)} {up} {random.choice(STATES)}",
            f"{up} TXN POS PURCHASE",
            f"BIL/ONL/{_ref(12)}/{up}/{random.choice(BANKS)}",
            f"ECOM PUR {up} {random.choice(STATES)}",
        ]), "bank_statement"),
        (random.choice(SENTENCE_TEMPLATES).format(m=random.choice([m, m.lower()])), "natural_language"),
    ]
    if len(m) > 4:
        out.append((add_noise(m), "typo"))
    return out


def expand_phrase(p: str) -> list[tuple[str, str]]:
    return [
        (p, "natural_language"),
        (random.choice([f"{p} {generate_amount()}", f"{generate_amount()} {p}", f"paid {generate_amount()} for {p}"]), "phrase_amount"),
    ]


FIRST_NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Rohit", "Pooja", "Arjun", "Kavya", "Suresh", "Neha",
               "Manoj", "Divya", "Karan", "Ritu", "Sanjay", "Meera", "Aditya", "Shreya", "Ravi", "Nisha", "Deepak", "Lakshmi",
               "Imran", "Fatima", "Harpreet", "Gurpreet", "Joseph", "Mary", "Venkat", "Lalitha", "Arun", "Bhavna", "Mohit", "Sunita"]
SURNAMES = ["Sharma", "Verma", "Patel", "Iyer", "Reddy", "Nair", "Gupta", "Singh", "Khan", "Das", "Joshi", "Kulkarni",
            "Mehta", "Rao", "Banerjee", "Pillai", "Shaikh", "Fernandes", "Chauhan", "Mishra"]
RELATIONS = ["mom", "dad", "bhai", "didi", "wife", "husband", "friend", "roommate", "landlord uncle", "chacha", "mama ji"]


def person_transfers(n: int = 600) -> pd.DataFrame:
    """UPI/IMPS transfers to individuals: the most common Misc case, which the LLM lexicon barely covers."""
    rows = []
    for k in range(n):
        first, last = random.choice(FIRST_NAMES), random.choice(SURNAMES)
        name = f"{first} {last}".upper()
        text, style = random.choice([
            (f"UPI/DR/{_ref(12)}/{name}/{random.choice(HANDLES)}", "upi"),
            (f"UPI/CR/{_ref(12)}/{name}/{random.choice(BANKS)}", "upi"),
            (f"UPI-{first.upper()}{last.upper()}-{_ref(6)}@{random.choice(HANDLES)}", "upi"),
            (f"IMPS/P2A/{_ref(12)}/{name}/{random.choice(BANKS)}0{_ref(6)}", "bank_statement"),
            (f"NEFT/{random.choice(BANKS)}N{_ref(9)}/{name}", "bank_statement"),
            (random.choice([f"paid {first.lower()}", f"sent to {first.lower()}", f"{first.lower()} upi",
                            f"paid {first.lower()} {generate_amount()}", f"transfer to {first} {last}"]), "natural_language"),
            (random.choice([f"sent money to {random.choice(RELATIONS)}", f"{random.choice(RELATIONS)} ko paise bheje",
                            f"paid {random.choice(RELATIONS)} {generate_amount()}"]), "natural_language"),
        ])
        rows.append({"text": text, "category": "Misc", "type": "Need", "style": style, "merchant": f"person:{first}-{last}"})
    return pd.DataFrame(rows)


def expand(lex: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for i, r in lex.iterrows():
        variants = expand_merchant(r["text"]) if r["kind"] == "merchant" else expand_phrase(r["text"])
        for text, style in variants:
            rows.append({"text": text, "category": r["category"], "type": r["type"], "style": style, "merchant": f"{r['kind']}:{i}"})
    return pd.concat([pd.DataFrame(rows), person_transfers()], ignore_index=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen2.5:7b")
    ap.add_argument("--n", type=int, default=50, help="items per LLM batch")
    args = ap.parse_args()
    random.seed(42)
    np.random.seed(42)

    lex = build_lexicon(args.model, args.n)
    lex.to_csv(os.path.join(DATA_DIR, "v4_lexicon_raw.csv"), index=False)
    lex = verify_lexicon(lex, args.model)
    lex.to_csv(os.path.join(DATA_DIR, "v4_lexicon.csv"), index=False)
    print(f"[OK] Lexicon: {len(lex)} items\n{lex.groupby(['category', 'type']).size().to_string()}")

    df = expand(lex)
    human = label_human_types(args.model)
    human_train, human_test = train_test_split(human, test_size=0.20, random_state=42, stratify=human["category"])
    human_train.to_csv(os.path.join(DATA_DIR, "v4_human_train.csv"), index=False)
    human_test.to_csv(os.path.join(DATA_DIR, "v4_human_test.csv"), index=False)
    print(f"[SAVED] v4_human_train.csv: {len(human_train)} rows, v4_human_test.csv: {len(human_test)} rows")

    # Human held-out rows must never leak into the LLM corpus.
    held = set(human_test["text"].str.lower().str.strip())
    df = df[~df["text"].str.lower().str.strip().isin(held)].drop_duplicates("text")

    groups = np.array(df["merchant"].unique(), dtype=object)
    rng = np.random.default_rng(42)
    rng.shuffle(groups)
    n_val, n_test = int(len(groups) * 0.1), int(len(groups) * 0.1)
    val_g, test_g = set(groups[:n_val]), set(groups[n_val:n_val + n_test])
    splits = {
        "val": df[df["merchant"].isin(val_g)],
        "test": df[df["merchant"].isin(test_g)],
        "train": df[~df["merchant"].isin(val_g | test_g)],
    }
    assert not set(splits["train"]["merchant"]) & set(splits["test"]["merchant"]), "merchant leakage"
    for name, part in splits.items():
        part.sample(frac=1.0, random_state=42).to_csv(os.path.join(DATA_DIR, f"v4_{name}.csv"), index=False)
        print(f"[SAVED] v4_{name}.csv: {len(part):,} rows")


if __name__ == "__main__":
    main()
