"""
classifier/evaluate.py
----------------------
Phase 8: Comprehensive Evaluation and A/B Testing.
Compares the Legacy TF-IDF classifier with the new MiniLM classifier.

Evaluates on:
  1. Held-out FINAURA-specific test set (never trained on)
  2. Validation set

Reports:
  - Accuracy, Macro F1, Weighted F1
  - Performance latency (load time, avg, median, p95)
"""

import os
import time
import pickle
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

from classifier.minilm_inference import MiniLMClassifier
import logging
logging.getLogger("transformers").setLevel(logging.ERROR)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


# ─── Legacy Model Wrapper ──────────────────────────────────────────────────
class LegacyClassifier:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        
    def load(self):
        t0 = time.time()
        model_path = os.path.join(BASE_DIR, "classifier_model.pkl")
        vectorizer_path = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
        
        with open(model_path, "rb") as f:
            self.model = pickle.load(f)
        with open(vectorizer_path, "rb") as f:
            self.vectorizer = pickle.load(f)
        return time.time() - t0
        
    def predict(self, text: str) -> dict:
        import re
        # Clean
        t = text.lower()
        t = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", t)
        t = re.sub(r"\b\d+\b", " ", t)
        t = re.sub(r"[^a-z\s]", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        
        vec = self.vectorizer.transform([t])
        category = self.model.predict(vec)[0]
        return {"category": category}


# ─── Evaluation Logic ─────────────────────────────────────────────────────

def measure_latency(model, texts: list, n_iters=100) -> dict:
    """Measure inference latency on a sample of texts."""
    # Warmup
    for t in texts[:5]:
        model.predict(t)
        
    times = []
    # Test random samples
    np.random.seed(42)
    sample_texts = np.random.choice(texts, min(n_iters, len(texts)))
    
    for t in sample_texts:
        t0 = time.time()
        model.predict(t)
        times.append((time.time() - t0) * 1000) # ms
        
    return {
        "avg": np.mean(times),
        "median": np.median(times),
        "p95": np.percentile(times, 95)
    }

def evaluate_on_df(model, df: pd.DataFrame, label_col: str = 'category'):
    """Calculate metrics for a dataset."""
    y_true = []
    y_pred = []
    
    for _, row in df.iterrows():
        cat = row[label_col]
        if pd.isna(cat) or cat is None:
            continue
            
        pred = model.predict(str(row['text']))
        y_true.append(str(cat))
        y_pred.append(pred['category'])
        
    acc = accuracy_score(y_true, y_pred)
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
    weight_p, weight_r, weight_f1, _ = precision_recall_fscore_support(y_true, y_pred, average='weighted', zero_division=0)
    
    return {
        "accuracy": acc,
        "macro_f1": macro_f1,
        "weighted_f1": weight_f1
    }

def evaluate_ambiguous(model, df: pd.DataFrame):
    """Check how models handle ambiguous tests (do they flag them?)."""
    results = []
    for _, row in df.iterrows():
        pred = model.predict(str(row['text']))
        
        # Legacy doesn't have explicit flagging, just see if it guesses Misc
        is_flagged = pred.get('flagged_for_review', pred['category'] == 'Misc')
        results.append(is_flagged)
        
    return sum(results) / len(results) if results else 0


def main():
    print("=" * 70)
    print("  PHASE 8: EVALUATION & A/B COMPARISON")
    print("=" * 70)
    
    # 1. Load Data
    val_path = os.path.join(OUT_DIR, "finaura_validation_data.csv")
    test_path = os.path.join(OUT_DIR, "finaura_test_set.csv")
    
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)
    
    # Split test set into clear vs ambiguous
    test_clear = test_df[~test_df['is_ambiguous']]
    test_ambig = test_df[test_df['is_ambiguous']]
    
    # 2. Load Models & Measure Load Time
    print("\n⏳ Loading models...")
    
    legacy = LegacyClassifier()
    leg_load = legacy.load()
    print(f"   Legacy TF-IDF loaded in {leg_load*1000:.1f} ms")
    
    minilm = MiniLMClassifier()
    t0 = time.time()
    minilm.load()
    ml_load = time.time() - t0
    device_name = "MPS (GPU)" if str(minilm.device) == 'mps' else str(minilm.device).upper()
    print(f"   MiniLM loaded in {ml_load*1000:.1f} ms [Device: {device_name}]")
    
    # 3. Evaluate Metrics
    print("\n📊 Evaluating Validation Set (2,535 rows)...")
    leg_val = evaluate_on_df(legacy, val_df, 'category')
    ml_val = evaluate_on_df(minilm, val_df, 'category')
    
    print("📊 Evaluating FINAURA Held-out Test Set (55 clear rows)...")
    leg_test = evaluate_on_df(legacy, test_clear, 'expected_category')
    ml_test = evaluate_on_df(minilm, test_clear, 'expected_category')
    
    # 4. Evaluate Ambiguity Handling
    print("🤔 Evaluating Ambiguity Handling (11 ambiguous rows)...")
    leg_ambig = evaluate_ambiguous(legacy, test_ambig)
    ml_ambig = evaluate_ambiguous(minilm, test_ambig)
    
    # 5. Measure Latency
    print("⏱️  Measuring Inference Latency (100 random samples)...")
    texts = val_df['text'].tolist()
    leg_lat = measure_latency(legacy, texts)
    ml_lat = measure_latency(minilm, texts)
    
    # 6. Report
    print("\n" + "=" * 70)
    print("  RESULTS COMPARISON")
    print("=" * 70)
    
    print("\n1. PERFORMANCE METRICS (Higher is better)")
    print(f"{'Metric':<25} | {'Legacy TF-IDF':<15} | {'MiniLM-L6-v2':<15}")
    print("-" * 60)
    print(f"{'Val Accuracy':<25} | {leg_val['accuracy']*100:>14.1f}% | {ml_val['accuracy']*100:>14.1f}%")
    print(f"{'Val Macro F1':<25} | {leg_val['macro_f1']*100:>14.1f}% | {ml_val['macro_f1']*100:>14.1f}%")
    print(f"{'Val Weighted F1':<25} | {leg_val['weighted_f1']*100:>14.1f}% | {ml_val['weighted_f1']*100:>14.1f}%")
    print("-" * 60)
    print(f"{'Test Accuracy (FINAURA)':<25} | {leg_test['accuracy']*100:>14.1f}% | {ml_test['accuracy']*100:>14.1f}%")
    print(f"{'Test Macro F1':<25} | {leg_test['macro_f1']*100:>14.1f}% | {ml_test['macro_f1']*100:>14.1f}%")
    print("-" * 60)
    print(f"{'Ambiguous Handled (Flag)':<25} | {leg_ambig*100:>14.1f}% | {ml_ambig*100:>14.1f}%")
    
    print("\n2. INFERENCE LATENCY (Lower is better)")
    print(f"{'Metric':<25} | {'Legacy TF-IDF':<15} | {'MiniLM-L6-v2':<15}")
    print("-" * 60)
    print(f"{'Average':<25} | {leg_lat['avg']:>11.2f} ms | {ml_lat['avg']:>11.2f} ms")
    print(f"{'Median':<25} | {leg_lat['median']:>11.2f} ms | {ml_lat['median']:>11.2f} ms")
    print(f"{'p95':<25} | {leg_lat['p95']:>11.2f} ms | {ml_lat['p95']:>11.2f} ms")
    
    print("\n" + "=" * 70)
    print("  CONCLUSION / RECOMMENDATION")
    print("=" * 70)
    
    if ml_test['accuracy'] > leg_test['accuracy'] + 0.05:
        print("Recommendation: [A] MiniLM is clearly better on the Indian test set. Switch.")
    elif ml_test['accuracy'] > leg_test['accuracy']:
        print("Recommendation: [B] MiniLM is slightly better. Recommend further testing.")
    else:
        print("Recommendation: [C] MiniLM is worse on the Indian test set. Keep legacy.")

if __name__ == "__main__":
    main()
