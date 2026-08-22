"""
classifier/exp2_evaluate.py
---------------------------
Experiment 2: Multi-dimensional Evaluation.
Compares:
  - Legacy TF-IDF
  - MiniLM v1 (Generic)
  - MiniLM v2 (Indian Domain)

Evaluates on strict slices from exp2_test_data.csv:
  - Seen vs Unseen merchants
  - Input types (Short, UPI, Long, Ambiguous)
"""

import os
import time
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import logging

# Suppress transformer warnings
logging.getLogger("transformers").setLevel(logging.ERROR)

from classifier.minilm_inference import MiniLMClassifier

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── Legacy Model Wrapper ──────────────────────────────────────────────────
class LegacyClassifier:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        
    def load(self):
        model_path = os.path.join(BASE_DIR, "classifier_model.pkl")
        vectorizer_path = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
        
        with open(model_path, "rb") as f:
            self.model = pickle.load(f)
        with open(vectorizer_path, "rb") as f:
            self.vectorizer = pickle.load(f)
            
    def predict(self, text: str) -> dict:
        import re
        t = str(text).lower()
        t = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", t)
        t = re.sub(r"\b\d+\b", " ", t)
        t = re.sub(r"[^a-z\s]", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        
        vec = self.vectorizer.transform([t])
        category = self.model.predict(vec)[0]
        return {"category": category}

# ─── Evaluation Logic ─────────────────────────────────────────────────────

def evaluate_slice(model, df: pd.DataFrame, desc: str):
    if len(df) == 0:
        return {"accuracy": 0.0, "macro_f1": 0.0, "count": 0}
        
    y_true, y_pred = [], []
    for _, row in df.iterrows():
        pred = model.predict(row['text'])
        y_true.append(row['category'])
        y_pred.append(pred['category'])
        
    acc = accuracy_score(y_true, y_pred)
    _, _, macro_f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
    
    return {"accuracy": acc, "macro_f1": macro_f1, "count": len(df)}

def evaluate_ambiguous(model, df: pd.DataFrame):
    if len(df) == 0: return 0.0
    results = []
    for _, row in df.iterrows():
        pred = model.predict(row['text'])
        # Legacy only has category. MiniLM has flagged_for_review.
        # Fallback to checking if category == 'Misc' for legacy.
        is_flagged = pred.get('flagged_for_review', pred['category'] == 'Misc')
        results.append(is_flagged)
    return sum(results) / len(results)

def main():
    print("=" * 80)
    print("  EXPERIMENT 2: EVALUATION & A/B/C COMPARISON")
    print("=" * 80)
    
    test_path = os.path.join(OUT_DIR, "exp2_test_data.csv")
    test_df = pd.read_csv(test_path)
    
    # ─── 1. Load Models ───
    print("\n⏳ Loading models...")
    
    legacy = LegacyClassifier()
    legacy.load()
    
    # MiniLM v1 (From Experiment 1)
    minilm_v1 = MiniLMClassifier(model_path=os.path.join(BASE_DIR, "models", "minilm-finaura"))
    minilm_v1.load()
    
    # MiniLM v2 (From Experiment 2)
    minilm_v2 = MiniLMClassifier(model_path=os.path.join(BASE_DIR, "models", "minilm-finaura-v2"))
    minilm_v2.load()
    
    models = {
        "Legacy TF-IDF": legacy,
        "MiniLM v1 (Gen)": minilm_v1,
        "MiniLM v2 (Ind)": minilm_v2
    }
    
    # ─── 2. Prepare Slices ───
    unseen_mask = ~test_df['merchant_concept'].astype(str).str.contains("_SEEN|Ambiguous", na=False)
    seen_mask = test_df['merchant_concept'].astype(str).str.contains("_SEEN", na=False)
    
    df_unseen = test_df[unseen_mask]
    df_seen = test_df[seen_mask]
    
    slices = {
        "A. Seen Merchants (Unseen Phrasing)": df_seen,
        "B. Unseen Merchants (Generalization)": df_unseen,
        "C. Input: Merchant Only": test_df[test_df['input_type'] == 'merchant_only'],
        "D. Input: Merchant + Amount": test_df[test_df['input_type'] == 'merchant_amount'],
        "E. Input: UPI String": test_df[test_df['input_type'] == 'upi_string'],
        "F. Input: Natural Language": test_df[test_df['input_type'] == 'natural_language'],
        "G. Input: Misspelling/Noise": test_df[test_df['input_type'] == 'misspelling']
    }
    
    ambiguous_df = test_df[test_df['input_type'] == 'ambiguous']
    
    # ─── 3. Evaluate & Report ───
    print("\n" + "=" * 80)
    print(f"{'EVALUATION METRIC (ACCURACY)':<40} | {'Legacy':<10} | {'MiniLM v1':<10} | {'MiniLM v2':<10}")
    print("-" * 80)
    
    for name, df_slice in slices.items():
        if len(df_slice) == 0: continue
        
        leg_res = evaluate_slice(legacy, df_slice, name)
        v1_res = evaluate_slice(minilm_v1, df_slice, name)
        v2_res = evaluate_slice(minilm_v2, df_slice, name)
        
        print(f"{name:<40} | {leg_res['accuracy']*100:>9.1f}% | {v1_res['accuracy']*100:>9.1f}% | {v2_res['accuracy']*100:>9.1f}%")
        
    print("-" * 80)
    # Ambiguous Handling
    leg_ambig = evaluate_ambiguous(legacy, ambiguous_df)
    v1_ambig = evaluate_ambiguous(minilm_v1, ambiguous_df)
    v2_ambig = evaluate_ambiguous(minilm_v2, ambiguous_df)
    print(f"{'H. Ambiguous Flagged Correctly':<40} | {leg_ambig*100:>9.1f}% | {v1_ambig*100:>9.1f}% | {v2_ambig*100:>9.1f}%")
    
    print("\n" + "=" * 80)
    print("  CONCLUSION / RECOMMENDATION")
    print("=" * 80)
    print("Compare 'B. Unseen Merchants' performance.")
    print("If v2 > Legacy on Unseen, it proves MiniLM CAN generalize if given domain data.")
    print("If Legacy still wins on 'C. Merchant Only', we may need a hybrid approach.")

if __name__ == "__main__":
    main()
