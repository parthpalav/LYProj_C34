"""
ml-service/run_v3_acceptance_audit.py
Comprehensive Pre-Commit Acceptance Audit for FINAURA Taxonomy V3.
"""

import os
import sys
import re
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix, precision_recall_fscore_support

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from classifier.rules import match_merchant_rule, clean_rule_text
from classifier.hybrid_pipeline import HybridClassifier, CATEGORY_TYPE_MAP, CATEGORY_SENTIMENT

CANONICAL_V3_CATEGORIES = [
    "Food & Dining",
    "Groceries",
    "Transport & Travel",
    "Housing",
    "Utilities & Bills",
    "Debt & Loan Payments",
    "Shopping",
    "Entertainment",
    "Health",
    "Education",
    "Personal Care",
    "Insurance",
    "Investments",
    "Misc",
]

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

print("=" * 70)
print("  FINAURA TAXONOMY V3 PRE-COMMIT ACCEPTANCE AUDIT")
print("=" * 70)

# ── 1. Dataset Verification ──
df = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv")).dropna(subset=["text", "category"])
df["text"] = df["text"].astype(str).str.strip()
df["category"] = df["category"].astype(str).str.strip()
df["clean"] = df["text"].apply(clean_text)

dataset_categories = sorted(df["category"].unique())
print(f"\n1. DATASET AUDIT:")
print(f"   Total Samples: {len(df)}")
print(f"   Categories ({len(dataset_categories)}): {dataset_categories}")
assert dataset_categories == sorted(CANONICAL_V3_CATEGORIES), "Dataset classes do not match Canonical V3!"

# ── 2. Stratified 80/20 Held-Out Evaluation ──
X = df["clean"]
y = df["category"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

vec = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
X_train_vec = vec.fit_transform(X_train)
X_test_vec = vec.transform(X_test)

clf = LogisticRegression(max_iter=500, solver="lbfgs", C=5.0, class_weight="balanced", random_state=42)
clf.fit(X_train_vec, y_train)

y_pred = clf.predict(X_test_vec)

acc = accuracy_score(y_test, y_pred)
macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(y_test, y_pred, average="macro", zero_division=0)
weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)

print(f"\n2. HELD-OUT 80/20 EVALUATION (N={len(y_test)}):")
print(f"   Accuracy:     {acc*100:.2f}%")
print(f"   Macro Prec:   {macro_p*100:.2f}%")
print(f"   Macro Recall: {macro_r*100:.2f}%")
print(f"   Macro F1:     {macro_f1*100:.2f}%")
print(f"   Weighted F1:  {weighted_f1*100:.2f}%")

print("\n3. PER-CLASS HELD-OUT METRICS:")
print(classification_report(y_test, y_pred, zero_division=0))

classes = sorted(list(y.unique()))
cm = confusion_matrix(y_test, y_pred, labels=classes)
cm_df = pd.DataFrame(cm, index=classes, columns=classes)
print("4. CONFUSION MATRIX (Rows: True, Cols: Predicted):")
print(cm_df.to_string())

# Find major confusion pairs
confusions = []
for i, true_cls in enumerate(classes):
    for j, pred_cls in enumerate(classes):
        if i != j and cm[i, j] > 0:
            confusions.append((true_cls, pred_cls, cm[i, j]))

confusions.sort(key=lambda x: x[2], reverse=True)
print("\n5. TOP CONFUSION PAIRS (True -> Predicted: Count):")
for true_c, pred_c, cnt in confusions:
    print(f"   {true_c} -> {pred_c} ({cnt})")

# ── 3. 5-Fold Stratified Cross-Validation ──
print("\n6. 5-FOLD STRATIFIED CROSS-VALIDATION:")
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_accs, cv_macro_f1s = [], []
for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
    X_tr, y_tr = X.iloc[train_idx], y.iloc[train_idx]
    X_va, y_va = X.iloc[val_idx], y.iloc[val_idx]
    
    v = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
    X_tr_v = v.fit_transform(X_tr)
    X_va_v = v.transform(X_va)
    
    m = LogisticRegression(max_iter=500, solver="lbfgs", C=5.0, class_weight="balanced", random_state=42)
    m.fit(X_tr_v, y_tr)
    pred_va = m.predict(X_va_v)
    
    fold_acc = accuracy_score(y_va, pred_va)
    fold_macro_f1 = precision_recall_fscore_support(y_va, pred_va, average="macro", zero_division=0)[2]
    cv_accs.append(fold_acc)
    cv_macro_f1s.append(fold_macro_f1)
    print(f"   Fold {fold}: Accuracy={fold_acc*100:.2f}%, Macro F1={fold_macro_f1*100:.2f}%")

print(f"   Mean CV Accuracy: {np.mean(cv_accs)*100:.2f}% (+/- {np.std(cv_accs)*100:.2f}%)")
print(f"   Mean CV Macro F1: {np.mean(cv_macro_f1s)*100:.2f}% (+/- {np.std(cv_macro_f1s)*100:.2f}%)")

# ── 4. Blind Hybrid Pipeline Evaluation ──
print("\n7. BLIND HYBRID PIPELINE EVALUATION (Unseen queries across all 14 categories):")
classifier = HybridClassifier(BASE_DIR)

blind_test_set = [
    # Food & Dining (Want)
    ("Chipotle burrito bowl for lunch", "Food & Dining", "Want"),
    ("Barbeque buffet dinner with team", "Food & Dining", "Want"),
    ("Late night dessert pastries order", "Food & Dining", "Want"),
    ("South Indian thali meal", "Food & Dining", "Want"),
    ("Gourmet burger and milkshake", "Food & Dining", "Want"),
    
    # Groceries (Need)
    ("Fresh farm tomatoes and onions", "Groceries", "Need"),
    ("Monthly cooking sunflower oil canister", "Groceries", "Need"),
    ("Organic brown eggs crate", "Groceries", "Need"),
    ("Wheat flour atta bag 10kg", "Groceries", "Need"),
    ("Supermarket daily provisions", "Groceries", "Need"),

    # Transport & Travel (Want / Need)
    ("Airport shuttle cab booking", "Transport & Travel", "Want"),
    ("Weekly railway season ticket", "Transport & Travel", "Need"),
    ("Interstate highway toll plaza fastag", "Transport & Travel", "Need"),
    ("Weekend resort stay booking", "Transport & Travel", "Want"),
    ("Petrol refill at shell pump", "Transport & Travel", "Need"),

    # Housing (Need)
    ("Monthly 2bhk residential flat rent", "Housing", "Need"),
    ("Gated community monthly maintenance charges", "Housing", "Need"),
    ("Municipal corporation property tax", "Housing", "Need"),
    ("Kitchen sink plumbing leakage repair", "Housing", "Need"),
    ("Home pest control fumigation service", "Housing", "Need"),

    # Utilities & Bills (Need)
    ("Monthly postpaid mobile connection bill", "Utilities & Bills", "Need"),
    ("Fiber optic broadband internet recharge", "Utilities & Bills", "Need"),
    ("Quarterly municipal water supply bill", "Utilities & Bills", "Need"),
    ("Cooking piped natural gas utility bill", "Utilities & Bills", "Need"),
    ("Monthly home electricity power bill", "Utilities & Bills", "Need"),

    # Debt & Loan Payments (Need)
    ("HDFC bank personal loan monthly emi", "Debt & Loan Payments", "Need"),
    ("SBI home loan principal interest installment", "Debt & Loan Payments", "Need"),
    ("Credit card total amount due settlement", "Debt & Loan Payments", "Need"),
    ("Two wheeler bike loan repayment", "Debt & Loan Payments", "Need"),
    ("Simpl bnpl monthly billing statement", "Debt & Loan Payments", "Need"),

    # Shopping (Want)
    ("Wireless noise cancelling headphones", "Shopping", "Want"),
    ("Denim jeans and cotton polo t-shirt", "Shopping", "Want"),
    ("Running sneakers athletics shoes", "Shopping", "Want"),
    ("Designer leather handbag", "Shopping", "Want"),
    ("Home decor wooden coffee table", "Shopping", "Want"),

    # Entertainment (Want)
    ("IMAX 3D movie tickets booking", "Entertainment", "Want"),
    ("Spotify family music annual plan", "Entertainment", "Want"),
    ("Live music concert passes", "Entertainment", "Want"),
    ("Playstation network digital game download", "Entertainment", "Want"),
    ("Cocktail lounge night party with colleagues", "Entertainment", "Want"),

    # Health (Need)
    ("Cardiologist hospital consultation fee", "Health", "Need"),
    ("Thyroid and lipid profile lab tests", "Health", "Need"),
    ("Chronic prescription blood pressure tablets", "Health", "Need"),
    ("Dental root canal clinic payment", "Health", "Need"),
    ("Physical rehabilitation therapy session", "Health", "Need"),

    # Education (Investment)
    ("Python data science masterclass course", "Education", "Investment"),
    ("University semester academic tuition fee", "Education", "Investment"),
    ("Chartered financial analyst exam fee", "Education", "Investment"),
    ("GRE competitive exam registration", "Education", "Investment"),
    ("Engineering textbook reference manuals", "Education", "Investment"),

    # Personal Care (Want)
    ("Men's barbershop styling and shave", "Personal Care", "Want"),
    ("Beauty parlour facial and cleanup package", "Personal Care", "Want"),
    ("Nail salon manicure and pedicure", "Personal Care", "Want"),
    ("Luxury sunscreen and moisturizer lotion", "Personal Care", "Want"),
    ("Hair spa conditioning treatment salon", "Personal Care", "Want"),

    # Insurance (Need)
    ("Family floater health insurance policy premium", "Insurance", "Need"),
    ("Term life insurance annual renewal payment", "Insurance", "Need"),
    ("Comprehensive car vehicle insurance premium", "Insurance", "Need"),
    ("Two wheeler motor third party insurance", "Insurance", "Need"),
    ("International travel insurance coverage", "Insurance", "Need"),

    # Investments (Investment)
    ("Monthly Nifty 50 index mutual fund SIP", "Investments", "Investment"),
    ("Nvidia tech shares equity portfolio", "Investments", "Investment"),
    ("Public provident fund PPF deposit", "Investments", "Investment"),
    ("Government sovereign gold bonds subscription", "Investments", "Investment"),
    ("National pension scheme NPS tier 1 contribution", "Investments", "Investment"),

    # Misc (Need)
    ("General petty cash miscellaneous withdrawal", "Misc", "Need"),
    ("Unspecified household expense", "Misc", "Need"),
    ("Miscellaneous transaction debit", "Misc", "Need"),
]

cat_correct = 0
type_correct = 0
rules_used = 0
tfidf_used = 0
review_flagged = 0

for text, exp_cat, exp_type in blind_test_set:
    res = classifier.classify(text)
    is_cat_match = (res["category"] == exp_cat)
    is_type_match = (res["type"] == exp_type)
    if is_cat_match: cat_correct += 1
    if is_type_match: type_correct += 1
    if res["classificationSource"] == "merchant_rule": rules_used += 1
    else: tfidf_used += 1
    if res["needsReview"]: review_flagged += 1

total_blind = len(blind_test_set)
print(f"   Total Blind Test Cases: {total_blind}")
print(f"   Hybrid Category Accuracy: {cat_correct}/{total_blind} ({cat_correct/total_blind*100:.1f}%)")
print(f"   Hybrid Type Accuracy:     {type_correct}/{total_blind} ({type_correct/total_blind*100:.1f}%)")
print(f"   Rule vs Model Split:      {rules_used} rules ({rules_used/total_blind*100:.1f}%) vs {tfidf_used} TF-IDF ({tfidf_used/total_blind*100:.1f}%)")
print(f"   Review Flag Rate:         {review_flagged}/{total_blind} ({review_flagged/total_blind*100:.1f}%)")

print("\n" + "=" * 70)
print("  AUDIT SCRIPT COMPLETE")
print("=" * 70)
