"""
classifier/analyze_dataset.py
------------------------------
Phase 3: Inspect available training data sources BEFORE any training.
Reports comprehensive statistics on each source.

Sources:
  1. DoDataThings/us-bank-transaction-categories (16K rows, public HuggingFace)
  2. FINAURA's existing dataset.csv (343 rows)

Run:
    cd ml-service && python3 -m classifier.analyze_dataset
"""

import os
import sys
import re
from collections import Counter

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_dodatathings():
    """Load the DoDataThings/us-bank-transaction-categories dataset."""
    from datasets import load_dataset
    print("⏳ Loading DoDataThings/us-bank-transaction-categories from HuggingFace...")
    ds = load_dataset("DoDataThings/us-bank-transaction-categories", split="train")
    df = ds.to_pandas()
    print(f"   ✅ Loaded {len(df):,} rows\n")
    return df


def load_finaura_existing():
    """Load FINAURA's existing hand-curated dataset.csv."""
    csv_path = os.path.join(BASE_DIR, "dataset.csv")
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["text", "category"])
    print(f"✅ FINAURA dataset.csv loaded: {len(df):,} rows\n")
    return df


def analyze_source(df, name, text_col, label_col):
    """Analyze a single data source comprehensively."""
    print(f"\n{'=' * 70}")
    print(f"  DATASET ANALYSIS: {name}")
    print(f"{'=' * 70}")
    
    total = len(df)
    
    # ─── 1. Basic shape ───────────────────────────────────────
    print(f"\n📊 BASIC STATISTICS")
    print(f"   Total rows:    {total:,}")
    print(f"   Columns:       {list(df.columns)}")
    
    # ─── 2. Labels / Class distribution ───────────────────────
    print(f"\n📋 CLASS DISTRIBUTION")
    labels = df[label_col].value_counts()
    for label, count in labels.items():
        pct = count / total * 100
        bar = "█" * int(pct / 2)
        print(f"   {str(label):35s}  {count:>6,}  ({pct:5.1f}%)  {bar}")
    
    unique_labels = df[label_col].nunique()
    print(f"\n   Unique labels: {unique_labels}")
    
    # ─── 3. Missing / Empty descriptions ──────────────────────
    print(f"\n🔍 DATA QUALITY")
    text_series = df[text_col].astype(str)
    null_desc = df[text_col].isna().sum()
    empty_desc = (text_series.str.strip() == '').sum()
    print(f"   Null descriptions:    {null_desc:,}")
    print(f"   Empty descriptions:   {empty_desc:,}")
    
    # ─── 4. Duplicates ───────────────────────────────────────
    unique_desc = df[text_col].nunique()
    duplicate_desc = total - unique_desc
    print(f"   Total descriptions:   {total:,}")
    print(f"   Unique descriptions:  {unique_desc:,}")
    print(f"   Duplicate descriptions: {duplicate_desc:,} ({duplicate_desc/total*100:.1f}%)")
    
    # Top 10 most repeated
    desc_counts = df[text_col].value_counts().head(10)
    if desc_counts.iloc[0] > 1:
        print(f"\n   Top 10 most repeated:")
        for desc, count in desc_counts.items():
            print(f"      {count:>4,}x  {str(desc)[:60]}")
    
    # ─── 5. INR / Indian content ──────────────────────────────
    print(f"\n🇮🇳 INDIAN CONTENT")
    inr_pattern = re.compile(r'(₹|rs\.?\s|inr\s|rupee)', re.IGNORECASE)
    indian_merchant_pattern = re.compile(
        r'(swiggy|zomato|flipkart|paytm|phonepe|gpay|google\s*pay|'
        r'jio|airtel|vodafone|bsnl|irctc|ola\b|rapido|'
        r'dmart|d-mart|bigbasket|blinkit|zepto|instamart|'
        r'myntra|nykaa|meesho|ajio|cred|razorpay|'
        r'hdfc|sbi|icici|axis|kotak|'
        r'byju|unacademy|upgrad|vedantu)',
        re.IGNORECASE
    )
    
    inr_mask = text_series.str.contains(inr_pattern, na=False)
    indian_mask = text_series.str.contains(indian_merchant_pattern, na=False)
    either = inr_mask | indian_mask
    
    print(f"   INR symbols (₹/rs/inr): {inr_mask.sum():,} ({inr_mask.sum()/total*100:.2f}%)")
    print(f"   Indian merchants:        {indian_mask.sum():,} ({indian_mask.sum()/total*100:.2f}%)")
    print(f"   Any Indian indicator:    {either.sum():,} ({either.sum()/total*100:.2f}%)")
    
    # ─── 6. Description length ────────────────────────────────
    print(f"\n📏 DESCRIPTION LENGTH")
    lengths = text_series.str.len()
    print(f"   Mean:   {lengths.mean():.1f} chars")
    print(f"   Median: {lengths.median():.0f} chars")
    print(f"   Min:    {lengths.min():.0f} chars")
    print(f"   Max:    {lengths.max():.0f} chars")
    
    # ─── 7. Samples ───────────────────────────────────────────
    print(f"\n📝 SAMPLE DESCRIPTIONS (3 per category, first 8 categories):")
    for label in list(labels.index)[:8]:
        print(f"\n   [{label}]")
        samples = df[df[label_col] == label][text_col].sample(
            n=min(3, len(df[df[label_col] == label])), random_state=42
        )
        for s in samples:
            print(f"      • {str(s)[:80]}")
    
    return {
        'total': total,
        'unique_labels': unique_labels,
        'unique_desc': unique_desc,
        'duplicates': duplicate_desc,
        'inr_rows': int(either.sum()),
    }


def analyze_finaura_mapping(df, text_col, label_col):
    """Analyze how DoDataThings categories map to FINAURA taxonomy."""
    from classifier.category_map import map_category
    
    print(f"\n{'=' * 70}")
    print(f"  FINAURA CATEGORY MAPPING ANALYSIS (DoDataThings → FINAURA)")
    print(f"{'=' * 70}")
    
    clean_count = 0
    ambiguous_count = 0
    discarded_count = 0
    finaura_dist = Counter()
    discard_reasons = Counter()
    
    for _, row in df.iterrows():
        cat = str(row[label_col])
        desc = str(row[text_col])
        finaura_cat, is_ambiguous = map_category(cat, desc)
        
        if finaura_cat is None:
            discarded_count += 1
            discard_reasons[cat] += 1
        elif is_ambiguous:
            ambiguous_count += 1
            finaura_dist[finaura_cat] += 1
        else:
            clean_count += 1
            finaura_dist[finaura_cat] += 1
    
    total = len(df)
    print(f"\n   Clean mappings:      {clean_count:>6,}  ({clean_count/total*100:.1f}%)")
    print(f"   Ambiguous mappings:  {ambiguous_count:>6,}  ({ambiguous_count/total*100:.1f}%)")
    print(f"   Discarded:           {discarded_count:>6,}  ({discarded_count/total*100:.1f}%)")
    
    if discard_reasons:
        print(f"\n   Discard reasons:")
        for reason, count in discard_reasons.most_common():
            print(f"      {reason:25s}  {count:>5,}")
    
    mappable_total = clean_count + ambiguous_count
    if mappable_total > 0:
        print(f"\n   FINAURA category distribution (mappable rows):")
        for cat, count in sorted(finaura_dist.items(), key=lambda x: -x[1]):
            pct = count / mappable_total * 100
            bar = "█" * int(pct / 2)
            print(f"      {cat:15s}  {count:>5,}  ({pct:5.1f}%)  {bar}")
        print(f"      {'TOTAL':15s}  {mappable_total:>5,}")
    
    # The DoDataThings categories need custom mapping since they differ from mitulshah
    print(f"\n   ⚠️  DoDataThings uses different categories than mitulshah.")
    print(f"      Categories not in our map that need handling:")
    ddt_cats = set(df[label_col].unique())
    from classifier.category_map import MITULSHAH_TO_FINAURA
    mapped_cats = set(MITULSHAH_TO_FINAURA.keys())
    unmapped = ddt_cats - mapped_cats
    for cat in sorted(unmapped):
        count = len(df[df[label_col] == cat])
        print(f"      • {cat} ({count:,} rows)")
    
    return {
        'clean': clean_count,
        'ambiguous': ambiguous_count,
        'discarded': discarded_count,
        'finaura_dist': dict(finaura_dist),
    }


def main():
    # Source 1: DoDataThings
    ddt_df = load_dodatathings()
    ddt_stats = analyze_source(ddt_df, "DoDataThings/us-bank-transaction-categories",
                               "description", "category")
    mapping_stats = analyze_finaura_mapping(ddt_df, "description", "category")
    
    # Source 2: FINAURA existing
    fin_df = load_finaura_existing()
    fin_stats = analyze_source(fin_df, "FINAURA dataset.csv (existing)",
                               "text", "category")
    
    # ─── Summary ──────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print(f"  SUMMARY & NEXT STEPS")
    print(f"{'=' * 70}")
    print(f"""
   Data Sources Available:
   ┌──────────────────────────────────────────────────────┐
   │ Source                    │  Rows   │ Indian │ Type  │
   ├──────────────────────────────────────────────────────┤
   │ DoDataThings (HuggingFace) │ {ddt_stats['total']:>6,} │ {ddt_stats['inr_rows']:>5,}  │ public│
   │ FINAURA dataset.csv        │ {fin_stats['total']:>6,} │ {fin_stats['inr_rows']:>5,}  │ curated│
   │ Indian augmentation (TBD)  │  ~500  │  ~500  │ manual│
   └──────────────────────────────────────────────────────┘
   
   Mapping Quality (DoDataThings → FINAURA):
     Clean:     {mapping_stats['clean']:,}
     Ambiguous: {mapping_stats['ambiguous']:,}
     Discarded: {mapping_stats['discarded']:,}
   
   ⚠️  The DoDataThings dataset uses 16 categories vs FINAURA's 10.
      The category_map.py needs to be extended with DoDataThings mappings.
      See the unmapped categories listed above.
   
   ✅ ANALYSIS COMPLETE — proceed to dataset preparation only after
      reviewing these results and updating the category map.
""")


if __name__ == '__main__':
    main()
