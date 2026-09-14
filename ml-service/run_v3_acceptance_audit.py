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
    text = str(text).lower()
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def load_and_clean_dataset(csv_path: str = None) -> pd.DataFrame:
    if csv_path is None:
        csv_path = os.path.join(BASE_DIR, "dataset.csv")
    df = pd.read_csv(csv_path).dropna(subset=["text", "category"])
    df["text"] = df["text"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()
    df["clean"] = df["text"].apply(clean_text)
    return df

def evaluate_v3_held_out(df: pd.DataFrame = None) -> dict:
    if df is None:
        df = load_and_clean_dataset()
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
    report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    report_text = classification_report(y_test, y_pred, zero_division=0)

    classes = sorted(list(y.unique()))
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    cm_df = pd.DataFrame(cm, index=classes, columns=classes)

    confusions = []
    for i, true_cls in enumerate(classes):
        for j, pred_cls in enumerate(classes):
            if i != j and cm[i, j] > 0:
                confusions.append((true_cls, pred_cls, int(cm[i, j])))
    confusions.sort(key=lambda x: x[2], reverse=True)

    return {
        "n_test": len(y_test),
        "accuracy": float(acc),
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "report_dict": report_dict,
        "report_text": report_text,
        "confusion_matrix": cm,
        "confusion_matrix_df": cm_df,
        "classes": classes,
        "top_confusions": confusions,
    }

def evaluate_v3_cross_validation(df: pd.DataFrame = None, n_splits: int = 5) -> dict:
    if df is None:
        df = load_and_clean_dataset()
    X = df["clean"]
    y = df["category"]

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    cv_accs, cv_macro_f1s = [], []
    fold_details = []
    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
        X_tr, y_tr = X.iloc[train_idx], y.iloc[train_idx]
        X_va, y_va = X.iloc[val_idx], y.iloc[val_idx]

        v = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
        X_tr_v = v.fit_transform(X_tr)
        X_va_v = v.transform(X_va)

        m = LogisticRegression(max_iter=500, solver="lbfgs", C=5.0, class_weight="balanced", random_state=42)
        m.fit(X_tr_v, y_tr)
        pred_va = m.predict(X_va_v)

        fold_acc = float(accuracy_score(y_va, pred_va))
        fold_macro_f1 = float(precision_recall_fscore_support(y_va, pred_va, average="macro", zero_division=0)[2])
        cv_accs.append(fold_acc)
        cv_macro_f1s.append(fold_macro_f1)
        fold_details.append({"fold": fold, "accuracy": fold_acc, "macro_f1": fold_macro_f1})

    return {
        "n_splits": n_splits,
        "fold_details": fold_details,
        "cv_accs": cv_accs,
        "cv_macro_f1s": cv_macro_f1s,
        "mean_accuracy": float(np.mean(cv_accs)),
        "std_accuracy": float(np.std(cv_accs)),
        "mean_macro_f1": float(np.mean(cv_macro_f1s)),
        "std_macro_f1": float(np.std(cv_macro_f1s)),
    }

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

def evaluate_hybrid_blind(classifier=None, test_set=None) -> dict:
    if classifier is None:
        classifier = HybridClassifier(BASE_DIR)
    if test_set is None:
        test_set = blind_test_set

    cat_correct = 0
    type_correct = 0
    rules_used = 0
    tfidf_used = 0
    review_flagged = 0
    samples = []

    for text, exp_cat, exp_type in test_set:
        res = classifier.classify(text)
        is_cat_match = (res["category"] == exp_cat)
        is_type_match = (res["type"] == exp_type)
        if is_cat_match: cat_correct += 1
        if is_type_match: type_correct += 1
        if res["classificationSource"] == "merchant_rule": rules_used += 1
        else: tfidf_used += 1
        if res["needsReview"]: review_flagged += 1
        samples.append({
            "text": text,
            "expected_category": exp_cat,
            "predicted_category": res["category"],
            "category_correct": is_cat_match,
            "expected_type": exp_type,
            "predicted_type": res["type"],
            "type_correct": is_type_match,
            "classification_source": res["classificationSource"],
            "category_confidence": float(res.get("categoryConfidence", res.get("confidence", 0.0))),
            "type_confidence": float(res.get("typeConfidence", 0.0)),
            "needs_review": bool(res["needsReview"]),
        })

    total_blind = len(test_set)
    return {
        "total": total_blind,
        "category_correct": cat_correct,
        "category_accuracy": float(cat_correct / total_blind),
        "type_correct": type_correct,
        "type_accuracy": float(type_correct / total_blind),
        "rules_used": rules_used,
        "rules_pct": float(rules_used / total_blind),
        "tfidf_used": tfidf_used,
        "tfidf_pct": float(tfidf_used / total_blind),
        "review_flagged": review_flagged,
        "review_flag_rate": float(review_flagged / total_blind),
        "samples": samples,
    }

def run_audit():
    print("=" * 70)
    print("  FINAURA TAXONOMY V3 PRE-COMMIT ACCEPTANCE AUDIT")
    print("=" * 70)

    # 1. Dataset Verification
    df = load_and_clean_dataset()
    dataset_categories = sorted(df["category"].unique())
    print(f"\n1. DATASET AUDIT:")
    print(f"   Total Samples: {len(df)}")
    print(f"   Categories ({len(dataset_categories)}): {dataset_categories}")
    assert dataset_categories == sorted(CANONICAL_V3_CATEGORIES), "Dataset classes do not match Canonical V3!"

    # 2. Stratified 80/20 Held-Out Evaluation
    held_out = evaluate_v3_held_out(df)
    print(f"\n2. HELD-OUT 80/20 EVALUATION (N={held_out['n_test']}):")
    print(f"   Accuracy:     {held_out['accuracy']*100:.2f}%")
    print(f"   Macro Prec:   {held_out['macro_precision']*100:.2f}%")
    print(f"   Macro Recall: {held_out['macro_recall']*100:.2f}%")
    print(f"   Macro F1:     {held_out['macro_f1']*100:.2f}%")
    print(f"   Weighted F1:  {held_out['weighted_f1']*100:.2f}%")

    print("\n3. PER-CLASS HELD-OUT METRICS:")
    print(held_out["report_text"])

    print("4. CONFUSION MATRIX (Rows: True, Cols: Predicted):")
    print(held_out["confusion_matrix_df"].to_string())

    print("\n5. TOP CONFUSION PAIRS (True -> Predicted: Count):")
    for true_c, pred_c, cnt in held_out["top_confusions"]:
        print(f"   {true_c} -> {pred_c} ({cnt})")

    # 3. 5-Fold Stratified Cross-Validation
    print("\n6. 5-FOLD STRATIFIED CROSS-VALIDATION:")
    cv = evaluate_v3_cross_validation(df)
    for fold_item in cv["fold_details"]:
        print(f"   Fold {fold_item['fold']}: Accuracy={fold_item['accuracy']*100:.2f}%, Macro F1={fold_item['macro_f1']*100:.2f}%")

    print(f"   Mean CV Accuracy: {cv['mean_accuracy']*100:.2f}% (+/- {cv['std_accuracy']*100:.2f}%)")
    print(f"   Mean CV Macro F1: {cv['mean_macro_f1']*100:.2f}% (+/- {cv['std_macro_f1']*100:.2f}%)")

    # 4. Blind Hybrid Pipeline Evaluation
    print("\n7. BLIND HYBRID PIPELINE EVALUATION (Unseen queries across all 14 categories):")
    hybrid = evaluate_hybrid_blind()
    print(f"   Total Blind Test Cases: {hybrid['total']}")
    print(f"   Hybrid Category Accuracy: {hybrid['category_correct']}/{hybrid['total']} ({hybrid['category_accuracy']*100:.1f}%)")
    print(f"   Hybrid Type Accuracy:     {hybrid['type_correct']}/{hybrid['total']} ({hybrid['type_accuracy']*100:.1f}%)")
    print(f"   Rule vs Model Split:      {hybrid['rules_used']} rules ({hybrid['rules_pct']*100:.1f}%) vs {hybrid['tfidf_used']} TF-IDF ({hybrid['tfidf_pct']*100:.1f}%)")
    print(f"   Review Flag Rate:         {hybrid['review_flagged']}/{hybrid['total']} ({hybrid['review_flag_rate']*100:.1f}%)")

    print("\n" + "=" * 70)
    print("  AUDIT SCRIPT COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    run_audit()
