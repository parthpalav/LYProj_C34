"""
classifier/prepare_dataset.py
------------------------------
Phase 4: Create unified training data with provenance tracking and
merchant-aware train/test splitting to prevent data leakage.

Creates:
  1. finaura_training_data.csv — merged, mapped, deduplicated training data
  2. finaura_test_set.csv     — held-out FINAURA-specific Indian test set (NEVER trained on)

Data Provenance:
  - 'ddt'       = DoDataThings/us-bank-transaction-categories (public HuggingFace)
  - 'finaura'   = FINAURA's existing dataset.csv (hand-curated)
  - 'augmented' = Manually curated Indian transaction strings
  - 'synthetic' = Programmatically generated variants

Run:
    cd ml-service && python3 -m classifier.prepare_dataset
"""

import os
import re
import hashlib
from collections import Counter

import pandas as pd
import numpy as np

from classifier.category_map import map_category, FINAURA_CATEGORIES

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


# ═══════════════════════════════════════════════════════════════
#  1. LOAD DATA SOURCES
# ═══════════════════════════════════════════════════════════════

def load_dodatathings() -> pd.DataFrame:
    """Load and map DoDataThings to FINAURA categories."""
    from datasets import load_dataset
    print("⏳ Loading DoDataThings dataset...")
    ds = load_dataset("DoDataThings/us-bank-transaction-categories", split="train")
    df = ds.to_pandas()
    
    rows = []
    discarded = 0
    ambiguous_kept = 0
    
    for _, row in df.iterrows():
        desc = str(row['description']).strip()
        cat = str(row['category'])
        
        finaura_cat, is_ambiguous = map_category(cat, desc)
        
        if finaura_cat is None:
            discarded += 1
            continue
        
        # Keep ambiguous rows mapped to Misc — the model should learn
        # that payment/transfer descriptions are "Misc" with low confidence
        if is_ambiguous:
            ambiguous_kept += 1
        
        rows.append({
            'text': desc,
            'category': finaura_cat,
            'source': 'ddt',
            'is_ambiguous': is_ambiguous,
        })
    
    result = pd.DataFrame(rows)
    print(f"   ✅ DoDataThings: {len(result):,} rows kept, {discarded:,} discarded, {ambiguous_kept:,} ambiguous")
    return result


def load_finaura_existing() -> pd.DataFrame:
    """Load FINAURA's hand-curated dataset."""
    csv_path = os.path.join(BASE_DIR, "dataset.csv")
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["text", "category"])
    df['text'] = df['text'].astype(str).str.strip()
    df['category'] = df['category'].astype(str).str.strip()
    df['source'] = 'finaura'
    df['is_ambiguous'] = False
    print(f"   ✅ FINAURA existing: {len(df):,} rows")
    return df[['text', 'category', 'source', 'is_ambiguous']]


def create_indian_augmentation() -> pd.DataFrame:
    """
    Manually curated Indian transaction strings.
    These are NOT synthetic/generated — they represent real Indian
    merchant names and transaction patterns that users actually encounter.
    
    Returns DataFrame with 'source' = 'augmented' for hand-written examples.
    """
    # Hand-curated examples based on real Indian merchant/service names
    augmented_data = [
        # ── Food (Indian restaurants, delivery, cuisine) ──────
        ("Swiggy order", "Food", "augmented"),
        ("Zomato delivery", "Food", "augmented"),
        ("Swiggy Instamart food", "Food", "augmented"),
        ("Dominos pizza delivery", "Food", "augmented"),
        ("McDonald's India", "Food", "augmented"),
        ("KFC order", "Food", "augmented"),
        ("Burger King", "Food", "augmented"),
        ("Pizza Hut delivery", "Food", "augmented"),
        ("Subway restaurant", "Food", "augmented"),
        ("Haldiram's", "Food", "augmented"),
        ("Barbeque Nation", "Food", "augmented"),
        ("Behrouz Biryani", "Food", "augmented"),
        ("Box8 order", "Food", "augmented"),
        ("EatSure", "Food", "augmented"),
        ("Faasos wrap", "Food", "augmented"),
        ("chai point", "Food", "augmented"),
        ("dhaba food", "Food", "augmented"),
        ("mess food canteen", "Food", "augmented"),
        ("restaurant bill dinner", "Food", "augmented"),
        ("lunch with friends cafe", "Food", "augmented"),
        ("street food pani puri", "Food", "augmented"),
        ("biryani order online", "Food", "augmented"),
        ("thali dinner", "Food", "augmented"),
        
        # ── Travel (Indian transport) ─────────────────────────
        ("Uber ride", "Travel", "augmented"),
        ("Ola cab booking", "Travel", "augmented"),
        ("Rapido bike taxi", "Travel", "augmented"),
        ("IRCTC train booking", "Travel", "augmented"),
        ("IRCTC tatkal ticket", "Travel", "augmented"),
        ("Ola auto rickshaw", "Travel", "augmented"),
        ("Mumbai metro card recharge", "Travel", "augmented"),
        ("Delhi metro smart card", "Travel", "augmented"),
        ("RedBus booking", "Travel", "augmented"),
        ("MakeMyTrip flight", "Travel", "augmented"),
        ("Goibibo hotel", "Travel", "augmented"),
        ("Cleartrip booking", "Travel", "augmented"),
        ("EaseMyTrip flight", "Travel", "augmented"),
        ("FASTag toll payment", "Travel", "augmented"),
        ("petrol pump HP", "Travel", "augmented"),
        ("Indian Oil fuel", "Travel", "augmented"),
        ("Bharat Petroleum diesel", "Travel", "augmented"),
        ("airport parking", "Travel", "augmented"),
        ("auto rickshaw fare", "Travel", "augmented"),
        ("train ticket second class", "Travel", "augmented"),
        
        # ── Entertainment ─────────────────────────────────────
        ("Netflix subscription", "Entertainment", "augmented"),
        ("Amazon Prime Video", "Entertainment", "augmented"),
        ("Disney+ Hotstar", "Entertainment", "augmented"),
        ("Spotify premium", "Entertainment", "augmented"),
        ("YouTube Premium", "Entertainment", "augmented"),
        ("Sony LIV subscription", "Entertainment", "augmented"),
        ("JioCinema premium", "Entertainment", "augmented"),
        ("BookMyShow movie ticket", "Entertainment", "augmented"),
        ("PVR Cinemas ticket", "Entertainment", "augmented"),
        ("INOX movie", "Entertainment", "augmented"),
        ("IPL match ticket", "Entertainment", "augmented"),
        ("cricket match ground ticket", "Entertainment", "augmented"),
        ("gaming subscription", "Entertainment", "augmented"),
        ("Steam game purchase", "Entertainment", "augmented"),
        ("PlayStation Plus", "Entertainment", "augmented"),
        
        # ── Shopping (Indian e-commerce) ──────────────────────
        ("Amazon India order", "Shopping", "augmented"),
        ("Flipkart purchase", "Shopping", "augmented"),
        ("Myntra fashion order", "Shopping", "augmented"),
        ("Nykaa beauty order", "Shopping", "augmented"),
        ("Meesho order", "Shopping", "augmented"),
        ("Ajio clothing", "Shopping", "augmented"),
        ("Tata CLiQ shopping", "Shopping", "augmented"),
        ("Snapdeal purchase", "Shopping", "augmented"),
        ("Croma electronics", "Shopping", "augmented"),
        ("Reliance Digital store", "Shopping", "augmented"),
        ("Decathlon sports", "Shopping", "augmented"),
        ("Lifestyle mall shopping", "Shopping", "augmented"),
        ("Shoppers Stop purchase", "Shopping", "augmented"),
        ("Pepperfry furniture", "Shopping", "augmented"),
        ("Urban Ladder sofa", "Shopping", "augmented"),
        ("saree purchase online", "Shopping", "augmented"),
        ("kurta pajama set", "Shopping", "augmented"),
        
        # ── Bills (Indian utilities, recharges) ───────────────
        ("Jio recharge prepaid", "Bills", "augmented"),
        ("Airtel postpaid bill", "Bills", "augmented"),
        ("Vodafone Idea recharge", "Bills", "augmented"),
        ("BSNL landline bill", "Bills", "augmented"),
        ("Tata Sky DTH recharge", "Bills", "augmented"),
        ("electricity bill MSEDCL", "Bills", "augmented"),
        ("water bill BMC", "Bills", "augmented"),
        ("gas bill Mahanagar Gas", "Bills", "augmented"),
        ("broadband ACT Fibernet", "Bills", "augmented"),
        ("Hathway cable bill", "Bills", "augmented"),
        ("society maintenance charges", "Bills", "augmented"),
        ("house rent monthly", "Bills", "augmented"),
        ("home loan EMI", "Bills", "augmented"),
        ("car loan EMI HDFC", "Bills", "augmented"),
        ("LIC premium payment", "Bills", "augmented"),
        ("ICICI Lombard insurance", "Bills", "augmented"),
        ("Bajaj Finserv EMI", "Bills", "augmented"),
        ("piped gas PNG bill", "Bills", "augmented"),
        ("municipal tax payment", "Bills", "augmented"),
        
        # ── Groceries (Indian grocery services) ──────────────
        ("BigBasket order", "Groceries", "augmented"),
        ("Blinkit delivery", "Groceries", "augmented"),
        ("Zepto quick delivery", "Groceries", "augmented"),
        ("Swiggy Instamart groceries", "Groceries", "augmented"),
        ("JioMart groceries", "Groceries", "augmented"),
        ("DMart supermarket", "Groceries", "augmented"),
        ("D-Mart weekly shopping", "Groceries", "augmented"),
        ("Reliance Fresh vegetables", "Groceries", "augmented"),
        ("More Supermarket", "Groceries", "augmented"),
        ("Nature's Basket organic", "Groceries", "augmented"),
        ("Spencer's supermarket", "Groceries", "augmented"),
        ("Star Bazaar groceries", "Groceries", "augmented"),
        ("Big Bazaar monthly ration", "Groceries", "augmented"),
        ("Grofers delivery", "Groceries", "augmented"),
        ("vegetables sabzi mandi", "Groceries", "augmented"),
        ("milk dairy delivery", "Groceries", "augmented"),
        ("atta flour rice grocery", "Groceries", "augmented"),
        
        # ── Health (Indian healthcare) ────────────────────────
        ("Apollo Pharmacy", "Health", "augmented"),
        ("Apollo Hospital consultation", "Health", "augmented"),
        ("Tata 1mg medicine", "Health", "augmented"),
        ("PharmEasy order", "Health", "augmented"),
        ("Netmeds medicine delivery", "Health", "augmented"),
        ("Practo doctor consultation", "Health", "augmented"),
        ("Fortis Hospital", "Health", "augmented"),
        ("Max Healthcare", "Health", "augmented"),
        ("Narayana Health", "Health", "augmented"),
        ("Thyrocare lab test", "Health", "augmented"),
        ("SRL Diagnostics blood test", "Health", "augmented"),
        ("Dr Lal PathLab checkup", "Health", "augmented"),
        ("Cult.fit gym membership", "Health", "augmented"),
        ("yoga class payment", "Health", "augmented"),
        ("dental clinic checkup", "Health", "augmented"),
        ("eye specialist visit", "Health", "augmented"),
        ("Medplus pharmacy", "Health", "augmented"),
        
        # ── Party (Indian social events) ──────────────────────
        ("birthday party decoration", "Party", "augmented"),
        ("wedding reception gift", "Party", "augmented"),
        ("Diwali party celebration", "Party", "augmented"),
        ("Holi party supplies", "Party", "augmented"),
        ("New Year party venue", "Party", "augmented"),
        ("farewell party food", "Party", "augmented"),
        ("kitty party contribution", "Party", "augmented"),
        ("house warming ceremony", "Party", "augmented"),
        ("engagement party", "Party", "augmented"),
        ("club entry night out", "Party", "augmented"),
        ("pub drinks party", "Party", "augmented"),
        ("hookah lounge", "Party", "augmented"),
        ("DJ night tickets", "Party", "augmented"),
        ("anniversary celebration dinner", "Party", "augmented"),
        ("bachelor party expenses", "Party", "augmented"),
        
        # ── Education (Indian education) ──────────────────────
        ("Udemy course purchase", "Education", "augmented"),
        ("Coursera subscription", "Education", "augmented"),
        ("Byju's subscription", "Education", "augmented"),
        ("Unacademy Plus", "Education", "augmented"),
        ("Vedantu online class", "Education", "augmented"),
        ("UpGrad program fee", "Education", "augmented"),
        ("college tuition fees", "Education", "augmented"),
        ("school fees payment", "Education", "augmented"),
        ("NEET coaching class", "Education", "augmented"),
        ("IIT JEE coaching", "Education", "augmented"),
        ("Simplilearn course", "Education", "augmented"),
        ("Great Learning MBA", "Education", "augmented"),
        ("textbook purchase", "Education", "augmented"),
        ("stationery for college", "Education", "augmented"),
        ("library card renewal", "Education", "augmented"),
        ("exam registration fee", "Education", "augmented"),
        ("competitive exam books", "Education", "augmented"),
        
        # ── Misc (genuinely ambiguous Indian transactions) ────
        ("ATM cash withdrawal", "Misc", "augmented"),
        ("temple donation", "Misc", "augmented"),
        ("mosque charity", "Misc", "augmented"),
        ("church offering", "Misc", "augmented"),
        ("gurudwara langar donation", "Misc", "augmented"),
        ("mobile repair shop", "Misc", "augmented"),
        ("laundry dry cleaning", "Misc", "augmented"),
        ("courier delivery charge", "Misc", "augmented"),
        ("passport application fee", "Misc", "augmented"),
        ("PAN card application", "Misc", "augmented"),
        ("Aadhaar update fee", "Misc", "augmented"),
        ("newspaper subscription", "Misc", "augmented"),
        ("pet food pet shop", "Misc", "augmented"),
        ("key duplicate locksmith", "Misc", "augmented"),
        ("parking challan fine", "Misc", "augmented"),
    ]
    
    df = pd.DataFrame(augmented_data, columns=['text', 'category', 'source'])
    df['is_ambiguous'] = False
    print(f"   ✅ Indian augmentation: {len(df):,} rows (hand-curated)")
    return df


def create_finaura_test_set() -> pd.DataFrame:
    """
    Create a HELD-OUT Indian test set that is NEVER used for training.
    Includes both clear-category and ambiguous examples.
    """
    test_data = [
        # ── Clear category tests ──────────────────────────────
        # Food
        ("Swiggy", "Food", False),
        ("Zomato order 450", "Food", False),
        ("Dominos pizza", "Food", False),
        ("KFC chicken bucket", "Food", False),
        ("chai tapri", "Food", False),
        ("biryani from restaurant", "Food", False),
        ("canteen lunch", "Food", False),
        
        # Travel
        ("Uber ride to airport", "Travel", False),
        ("Ola cab booking", "Travel", False),
        ("Rapido bike", "Travel", False),
        ("IRCTC train booking", "Travel", False),
        ("metro card recharge", "Travel", False),
        ("FASTag toll", "Travel", False),
        ("petrol pump fuel", "Travel", False),
        
        # Entertainment
        ("Netflix monthly", "Entertainment", False),
        ("Spotify subscription", "Entertainment", False),
        ("BookMyShow ticket", "Entertainment", False),
        ("PVR movie ticket", "Entertainment", False),
        ("Hotstar premium", "Entertainment", False),
        
        # Shopping
        ("Amazon India purchase", "Shopping", False),
        ("Flipkart order", "Shopping", False),
        ("Myntra clothing", "Shopping", False),
        ("Nykaa beauty products", "Shopping", False),
        ("Meesho order", "Shopping", False),
        ("shoes from mall", "Shopping", False),
        
        # Bills
        ("Jio recharge", "Bills", False),
        ("Airtel prepaid", "Bills", False),
        ("electricity bill payment", "Bills", False),
        ("house rent transfer", "Bills", False),
        ("EMI payment HDFC", "Bills", False),
        ("Tata Sky recharge", "Bills", False),
        ("wifi internet bill", "Bills", False),
        
        # Groceries
        ("BigBasket order", "Groceries", False),
        ("Blinkit delivery veggies", "Groceries", False),
        ("Zepto groceries", "Groceries", False),
        ("DMart shopping", "Groceries", False),
        ("Instamart milk bread", "Groceries", False),
        ("vegetables from market", "Groceries", False),
        
        # Health
        ("Apollo Pharmacy medicine", "Health", False),
        ("Tata 1mg order", "Health", False),
        ("doctor consultation fee", "Health", False),
        ("gym membership renewal", "Health", False),
        ("blood test lab", "Health", False),
        
        # Education
        ("Udemy course", "Education", False),
        ("Coursera subscription", "Education", False),
        ("college fees payment", "Education", False),
        ("tuition class monthly", "Education", False),
        ("books for semester", "Education", False),
        
        # Party
        ("birthday party supplies", "Party", False),
        ("club entry fee night", "Party", False),
        ("Diwali party snacks", "Party", False),
        ("wedding gift", "Party", False),
        
        # Misc
        ("ATM withdrawal", "Misc", False),
        ("temple donation", "Misc", False),
        ("courier charges", "Misc", False),
        
        # ── Ambiguous tests (evaluate confidence, not forced correctness) ──
        ("PhonePe transfer", None, True),
        ("Google Pay payment", None, True),
        ("Paytm transfer to vendor", None, True),
        ("CRED payment", None, True),
        ("UPI payment", None, True),
        ("500 rupees sent", None, True),
        ("payment received", None, True),
        ("Zerodha", None, True),     # could be investment, not clear expense
        ("Groww app", None, True),    # could be investment
        ("NEFT transfer", None, True),
        ("bank debit", None, True),
    ]
    
    df = pd.DataFrame(test_data, columns=['text', 'expected_category', 'is_ambiguous'])
    df['source'] = 'test_set'
    
    clear = len(df[~df['is_ambiguous']])
    ambig = len(df[df['is_ambiguous']])
    print(f"   ✅ FINAURA test set: {len(df):,} examples ({clear} clear, {ambig} ambiguous)")
    return df


# ═══════════════════════════════════════════════════════════════
#  2. MERCHANT-AWARE SPLITTING
# ═══════════════════════════════════════════════════════════════

def extract_merchant_key(text: str) -> str:
    """
    Extract a 'merchant key' from a transaction description.
    Used to group similar descriptions together so they don't
    leak across train/test splits.
    
    E.g. "Swiggy order 500" and "Swiggy order 600" both → "swiggy"
    """
    text = text.lower().strip()
    # Remove amounts and currency
    text = re.sub(r'(₹|rs\.?|inr|\$)\s*\d+(\.\d+)?', '', text)
    text = re.sub(r'\d+(\.\d+)?\s*(₹|rs\.?|inr|\$)', '', text)
    text = re.sub(r'\b\d+\b', '', text)
    # Remove common noise words
    text = re.sub(r'\b(order|payment|purchase|delivery|bill|subscription|recharge|monthly|weekly|daily)\b', '', text)
    # Collapse whitespace
    text = re.sub(r'[^a-z\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # Take first 2 significant words as the key
    words = [w for w in text.split() if len(w) > 1]
    return ' '.join(words[:2]) if words else text


def merchant_aware_split(df: pd.DataFrame, test_ratio: float = 0.15, seed: int = 42) -> tuple:
    """
    Split data into train/test ensuring that similar descriptions
    (same merchant) stay in the same split. Prevents data leakage.
    """
    np.random.seed(seed)
    
    # Assign merchant keys
    df = df.copy()
    df['_merchant_key'] = df['text'].apply(extract_merchant_key)
    
    # Get unique merchant keys
    unique_keys = df['_merchant_key'].unique()
    np.random.shuffle(unique_keys)
    
    # Split by merchant key (not by row)
    n_test_keys = max(1, int(len(unique_keys) * test_ratio))
    test_keys = set(unique_keys[:n_test_keys])
    
    test_mask = df['_merchant_key'].isin(test_keys)
    train_df = df[~test_mask].drop(columns=['_merchant_key']).reset_index(drop=True)
    test_df = df[test_mask].drop(columns=['_merchant_key']).reset_index(drop=True)
    
    return train_df, test_df


# ═══════════════════════════════════════════════════════════════
#  3. MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("  DATASET PREPARATION")
    print("=" * 70)
    
    # ── Load all sources ──────────────────────────────────────
    print("\n📥 Loading data sources...")
    ddt_df = load_dodatathings()
    fin_df = load_finaura_existing()
    aug_df = create_indian_augmentation()
    test_df = create_finaura_test_set()
    
    # ── Merge training data ───────────────────────────────────
    print("\n🔀 Merging training data...")
    merged = pd.concat([ddt_df, fin_df, aug_df], ignore_index=True)
    
    # Validate all categories are valid FINAURA categories
    invalid = merged[~merged['category'].isin(FINAURA_CATEGORIES)]
    if len(invalid) > 0:
        print(f"   ⚠️  {len(invalid)} rows with invalid categories:")
        print(f"      {invalid['category'].value_counts().to_dict()}")
        merged = merged[merged['category'].isin(FINAURA_CATEGORIES)]
    
    # Deduplicate (same text + same category)
    before = len(merged)
    merged = merged.drop_duplicates(subset=['text', 'category'], keep='first')
    after = len(merged)
    print(f"   Deduplicated: {before:,} → {after:,} ({before - after:,} duplicates removed)")
    
    # ── Remove test set leakage ───────────────────────────────
    # Ensure no test set descriptions appear in training data
    test_texts = set(test_df['text'].str.lower())
    test_merchants = set(test_df['text'].apply(extract_merchant_key))
    
    before = len(merged)
    merged_lower = merged['text'].str.lower()
    merged_merchants = merged['text'].apply(extract_merchant_key)
    
    # Remove exact matches
    exact_leak = merged_lower.isin(test_texts)
    # Remove merchant-key matches (conservative: prevents "Swiggy order 500" in train if "Swiggy" is in test)
    # Note: we only remove exact merchant-key matches for very short test descriptions
    # to avoid removing too much training data
    short_test_merchants = set(
        test_df[test_df['text'].str.len() <= 15]['text'].apply(extract_merchant_key)
    )
    merchant_leak = merged_merchants.isin(short_test_merchants)
    
    leak_mask = exact_leak | merchant_leak
    merged = merged[~leak_mask].reset_index(drop=True)
    print(f"   Removed test set leakage: {before:,} → {len(merged):,} ({leak_mask.sum():,} removed)")
    
    # ── Merchant-aware train/validation split ─────────────────
    print("\n📊 Splitting into train/validation (merchant-aware)...")
    train_df, val_df = merchant_aware_split(merged, test_ratio=0.15)
    
    # ── Provenance report ─────────────────────────────────────
    print("\n" + "=" * 70)
    print("  DATA PROVENANCE REPORT")
    print("=" * 70)
    
    for name, df_part in [("TRAINING", train_df), ("VALIDATION", val_df), ("TEST (held-out)", test_df)]:
        print(f"\n📦 {name}: {len(df_part):,} rows")
        if 'source' in df_part.columns:
            source_counts = df_part['source'].value_counts()
            for source, count in source_counts.items():
                label = {
                    'ddt': 'DoDataThings (public HuggingFace)',
                    'finaura': 'FINAURA existing (hand-curated)',
                    'augmented': 'Indian augmentation (manually curated)',
                    'synthetic': 'Programmatically generated',
                    'test_set': 'FINAURA test set (manually curated)',
                }.get(source, source)
                print(f"   {label:45s}  {count:>5,}  ({count/len(df_part)*100:.1f}%)")
        
        if 'category' in df_part.columns:
            cat_col = 'category'
        elif 'expected_category' in df_part.columns:
            cat_col = 'expected_category'
        else:
            continue
        
        print(f"\n   Category distribution:")
        cat_counts = df_part[cat_col].value_counts()
        for cat, count in cat_counts.items():
            if cat is not None and str(cat) != 'None':
                print(f"      {str(cat):15s}  {count:>5,}  ({count/len(df_part)*100:.1f}%)")
    
    # ── Save ──────────────────────────────────────────────────
    print(f"\n💾 Saving datasets...")
    
    train_path = os.path.join(OUT_DIR, "finaura_training_data.csv")
    val_path = os.path.join(OUT_DIR, "finaura_validation_data.csv")
    test_path = os.path.join(OUT_DIR, "finaura_test_set.csv")
    
    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print(f"   Training:   {train_path} ({len(train_df):,} rows)")
    print(f"   Validation: {val_path} ({len(val_df):,} rows)")
    print(f"   Test:       {test_path} ({len(test_df):,} rows)")
    
    # ── Leakage check ─────────────────────────────────────────
    print(f"\n🔒 DATA LEAKAGE CHECK")
    train_texts = set(train_df['text'].str.lower())
    val_texts = set(val_df['text'].str.lower())
    test_texts_check = set(test_df['text'].str.lower())
    
    train_val_overlap = train_texts & val_texts
    train_test_overlap = train_texts & test_texts_check
    val_test_overlap = val_texts & test_texts_check
    
    print(f"   Train ∩ Validation:  {len(train_val_overlap):,} exact text overlaps")
    print(f"   Train ∩ Test:        {len(train_test_overlap):,} exact text overlaps")
    print(f"   Validation ∩ Test:   {len(val_test_overlap):,} exact text overlaps")
    
    if train_test_overlap:
        print(f"   ⚠️  Train-test overlaps: {list(train_test_overlap)[:5]}")
    else:
        print(f"   ✅ No train-test leakage detected")
    
    print(f"\n{'=' * 70}")
    print(f"  DATASET PREPARATION COMPLETE")
    print(f"{'=' * 70}\n")


if __name__ == '__main__':
    main()
