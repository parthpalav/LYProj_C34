"""
classifier/exp2_generate_data.py
--------------------------------
Experiment 2: Data Augmentation & Dataset Generation.
Builds an Indian-first experimental dataset while strictly preventing data leakage
between seen and unseen (held-out) merchant concepts.

Outputs:
  - exp2_train_data.csv
  - exp2_val_data.csv
  - exp2_test_data.csv
"""

import os
import random
import pandas as pd
import numpy as np
from classifier.category_map import FINAURA_CATEGORIES

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
random.seed(42)
np.random.seed(42)

# ─── 1. Merchant Concepts (Strictly Separated) ────────────────────────────────

# These merchants will be augmented for the TRAINING set.
TRAIN_MERCHANTS = [
    ("Swiggy", "Food"), ("Dominos", "Food"), ("KFC", "Food"), ("Burger King", "Food"), ("Behrouz", "Food"),
    ("Uber", "Travel"), ("Rapido", "Travel"), ("IRCTC", "Travel"), ("RedBus", "Travel"), ("FASTag", "Travel"),
    ("Netflix", "Entertainment"), ("Hotstar", "Entertainment"), ("BookMyShow", "Entertainment"), ("Spotify", "Entertainment"),
    ("Amazon", "Shopping"), ("Myntra", "Shopping"), ("Meesho", "Shopping"), ("Croma", "Shopping"), ("Ajio", "Shopping"),
    ("Jio", "Bills"), ("Airtel", "Bills"), ("Tata Sky", "Bills"), ("BESCOM", "Bills"), ("LIC", "Bills"),
    ("BigBasket", "Groceries"), ("Blinkit", "Groceries"), ("DMart", "Groceries"), ("Reliance Fresh", "Groceries"),
    ("Apollo", "Health"), ("Practo", "Health"), ("Netmeds", "Health"), ("Fortis", "Health"),
    ("Udemy", "Education"), ("Coursera", "Education"), ("Byjus", "Education"), ("Unacademy", "Education"),
]

# These merchants will NEVER be seen in training. They are strictly for the TEST set.
# This proves generalization vs memorization.
TEST_MERCHANTS = [
    ("Zomato", "Food"), ("McDonalds", "Food"), ("Subway", "Food"),
    ("Ola", "Travel"), ("MakeMyTrip", "Travel"), ("Cleartrip", "Travel"),
    ("Prime Video", "Entertainment"), ("PVR", "Entertainment"),
    ("Flipkart", "Shopping"), ("Nykaa", "Shopping"), ("Decathlon", "Shopping"),
    ("Vi", "Bills"), ("MSEDCL", "Bills"), ("HDFC EMI", "Bills"),
    ("Zepto", "Groceries"), ("Instamart", "Groceries"), ("Star Bazaar", "Groceries"),
    ("Tata 1mg", "Health"), ("PharmEasy", "Health"),
    ("Vedantu", "Education"), ("UpGrad", "Education"),
]

# ─── 2. Augmentation Engine ──────────────────────────────────────────────────

def generate_amount():
    return random.choice([
        f"₹{random.randint(10, 5000)}",
        f"Rs {random.randint(10, 5000)}",
        f"{random.randint(10, 5000)}.00",
        str(random.randint(10, 5000))
    ])

def generate_upi_string(merchant):
    prefixes = ["UPI/CR/", "UPI/DR/", "NEFT/", "IMPS/", "BIL/ONL/"]
    banks = ["SBI", "HDFC", "ICICI", "AXIS"]
    txn_id = "".join([str(random.randint(0, 9)) for _ in range(12)])
    return f"{random.choice(prefixes)}{txn_id}/{merchant.upper()}/{random.choice(banks)}"

def generate_natural_language(merchant, category):
    templates = {
        "Food": ["ordered from {}", "paid {} for dinner", "{} delivery"],
        "Travel": ["ride with {}", "booked {} ticket", "travel via {}"],
        "Entertainment": ["{} subscription", "watched movie on {}", "paid for {}"],
        "Shopping": ["bought clothes from {}", "{} shopping", "order placed on {}"],
        "Bills": ["paid {} bill", "monthly {} recharge", "{} payment"],
        "Groceries": ["{} grocery delivery", "bought ration from {}", "{} weekly shopping"],
        "Health": ["medicines from {}", "{} doctor consultation", "paid {} clinic"],
        "Education": ["{} course fee", "enrolled in {}", "paid for {} class"],
        "Party": ["{} party supplies", "booking at {}"],
        "Misc": ["transfer to {}", "payment for {}"]
    }
    t = random.choice(templates.get(category, ["{} payment", "paid {}"]))
    return t.format(merchant)

def add_noise(merchant):
    if len(merchant) <= 3: return merchant
    # random typo (drop a vowel or duplicate a consonant)
    chars = list(merchant)
    if random.random() > 0.5:
        vowels = [i for i, c in enumerate(chars) if c.lower() in 'aeiou']
        if vowels:
            chars.pop(random.choice(vowels))
    else:
        idx = random.randint(0, len(chars)-1)
        chars.insert(idx, chars[idx])
    return "".join(chars).lower()


def build_dataset_from_concepts(merchants, num_variations_per_concept=100):
    rows = []
    
    for merchant, category in merchants:
        # We ensure a balanced distribution of input types
        types = ['merchant_only'] * 15 + \
                ['merchant_amount'] * 25 + \
                ['upi_string'] * 30 + \
                ['natural_language'] * 20 + \
                ['misspelling'] * 10
                
        # Scale to num_variations
        multiplier = num_variations_per_concept // 100
        if multiplier < 1: multiplier = 1
        types = types * multiplier
        
        for t in types:
            if t == 'merchant_only':
                text = merchant if random.random() > 0.5 else merchant.lower()
            elif t == 'merchant_amount':
                text = f"{merchant} {generate_amount()}" if random.random() > 0.5 else f"{generate_amount()} {merchant}"
            elif t == 'upi_string':
                text = generate_upi_string(merchant)
            elif t == 'natural_language':
                text = generate_natural_language(merchant, category)
            elif t == 'misspelling':
                text = add_noise(merchant)
                
            rows.append({
                'text': text,
                'category': category,
                'merchant_concept': merchant,
                'input_type': t,
                'source': 'augmented'
            })
            
    return pd.DataFrame(rows)

# ─── 3. Ambiguous / Misc Injector ─────────────────────────────────────────────

def build_ambiguous_data(num_samples=500):
    rows = []
    ambiguous_terms = ["PhonePe Transfer", "Google Pay", "Paytm Sent", "Cash Withdrawal", "UPI Transfer", "CRED Payment", "Bank Debit", "NEFT Trf"]
    for _ in range(num_samples):
        term = random.choice(ambiguous_terms)
        rows.append({
            'text': f"{term} {generate_amount()}" if random.random() > 0.5 else term,
            'category': 'Misc',
            'merchant_concept': 'Ambiguous_Transfer',
            'input_type': 'ambiguous',
            'source': 'augmented_ambiguous'
        })
    return pd.DataFrame(rows)

# ─── 4. Pipeline Execution ───────────────────────────────────────────────────

def main():
    print("=" * 60)
    print(" EXPERIMENT 2: INDIAN DATASET GENERATION")
    print("=" * 60)
    
    # 1. Generate Training Data
    # 36 train concepts * 300 variations = ~10,800 rows
    train_df = build_dataset_from_concepts(TRAIN_MERCHANTS, num_variations_per_concept=300)
    ambig_df = build_ambiguous_data(1000)
    
    full_train = pd.concat([train_df, ambig_df]).sample(frac=1.0, random_state=42).reset_index(drop=True)
    
    # Split Train into Train (85%) / Val (15%) using Merchant-Aware splitting
    concepts = full_train['merchant_concept'].unique()
    val_concepts = set(np.random.choice(concepts, size=int(len(concepts)*0.15), replace=False))
    
    val_mask = full_train['merchant_concept'].isin(val_concepts)
    val_data = full_train[val_mask]
    train_data = full_train[~val_mask]
    
    print(f"✅ Generated Training Set: {len(train_data):,} rows")
    print(f"✅ Generated Validation Set: {len(val_data):,} rows")
    
    # 2. Generate Test Data (Unseen Merchants)
    # 21 test concepts * 20 variations = 420 rows
    test_unseen = build_dataset_from_concepts(TEST_MERCHANTS, num_variations_per_concept=20)
    
    # Also grab some "Seen" merchants with "Unseen" phrasing (by regenerating them)
    # We take 5 train merchants and generate just 20 new variations
    seen_merchants_sample = random.sample(TRAIN_MERCHANTS, 5)
    test_seen = build_dataset_from_concepts(seen_merchants_sample, num_variations_per_concept=20)
    test_seen['merchant_concept'] = test_seen['merchant_concept'] + "_SEEN"
    
    # Test ambiguous
    test_ambig = build_ambiguous_data(50)
    
    full_test = pd.concat([test_unseen, test_seen, test_ambig]).reset_index(drop=True)
    print(f"✅ Generated Test Set: {len(full_test):,} rows")
    print(f"   - Completely Unseen Merchants: {len(test_unseen)}")
    print(f"   - Seen Merchants (New Phrasing): {len(test_seen)}")
    print(f"   - Ambiguous Transfers: {len(test_ambig)}")
    
    # 3. Verify Strict Leakage Rules
    train_concepts = set(train_data['merchant_concept'].unique())
    test_concepts = set(test_unseen['merchant_concept'].unique())
    leakage = train_concepts.intersection(test_concepts)
    assert len(leakage) == 0, f"DATA LEAKAGE DETECTED: {leakage}"
    
    # 4. Save
    train_data.to_csv(os.path.join(OUT_DIR, "exp2_train_data.csv"), index=False)
    val_data.to_csv(os.path.join(OUT_DIR, "exp2_val_data.csv"), index=False)
    full_test.to_csv(os.path.join(OUT_DIR, "exp2_test_data.csv"), index=False)
    print("\nFiles saved successfully to classifier/ directory.")

if __name__ == "__main__":
    main()
