import time
import os
import sys
import pickle
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sentence_transformers import SentenceTransformer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from classifier.hybrid_pipeline import HybridClassifier
from classifier.rules import match_merchant_rule

# --- Load datasets ---
train_df = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv"))
eval_df = pd.read_csv(os.path.join(BASE_DIR, "eval_dataset.csv"))

# --- Load TF-IDF artefacts ---
model_path = os.path.join(BASE_DIR, "classifier_model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")

with open(model_path, "rb") as f:
    tfidf_model = pickle.load(f)
with open(vectorizer_path, "rb") as f:
    tfidf_vectorizer = pickle.load(f)

# --- TF-IDF Only ---
def evaluate_tfidf(texts):
    start = time.time()
    vec = tfidf_vectorizer.transform(texts)
    preds = tfidf_model.predict(vec)
    probs = tfidf_model.predict_proba(vec)
    
    results = []
    for i, text in enumerate(texts):
        conf = probs[i].max()
        top2 = sorted(probs[i], reverse=True)[:2]
        margin = top2[0] - top2[1] if len(top2) > 1 else 0
        needs_review = conf < 0.60 or margin < 0.15
        results.append({
            "text": text,
            "pred": preds[i],
            "conf": conf,
            "needs_review": needs_review
        })
    latency = (time.time() - start) / len(texts)
    return results, latency

# --- Rules + TF-IDF (Hybrid) ---
hybrid_pipeline = HybridClassifier(BASE_DIR)
hybrid_pipeline.load_tfidf()

def evaluate_hybrid(texts):
    start = time.time()
    results = []
    for text in texts:
        res = hybrid_pipeline.classify(text)
        results.append({
            "text": text,
            "pred": res["category"],
            "conf": res["confidence"],
            "needs_review": res["needsReview"],
            "source": res["classificationSource"]
        })
    latency = (time.time() - start) / len(texts)
    return results, latency

# --- MiniLM ---
print("Loading MiniLM model...")
start_load = time.time()
sbert = SentenceTransformer('all-MiniLM-L6-v2')
minilm_load_time = time.time() - start_load
print(f"MiniLM load time: {minilm_load_time:.3f}s")

# Train MiniLM + LR on train data
print("Embedding training data...")
train_df = train_df.dropna(subset=["text", "category"])
X_train_texts = train_df["text"].tolist()
y_train = train_df["category"].tolist()
X_train_emb = sbert.encode(X_train_texts, show_progress_bar=False)

minilm_lr = LogisticRegression(max_iter=1000, solver="lbfgs", C=5.0, class_weight="balanced")
minilm_lr.fit(X_train_emb, y_train)

def evaluate_minilm(texts):
    start = time.time()
    emb = sbert.encode(texts, show_progress_bar=False)
    preds = minilm_lr.predict(emb)
    probs = minilm_lr.predict_proba(emb)
    results = []
    for i, text in enumerate(texts):
        conf = probs[i].max()
        top2 = sorted(probs[i], reverse=True)[:2]
        margin = top2[0] - top2[1] if len(top2) > 1 else 0
        needs_review = conf < 0.60 or margin < 0.15
        results.append({
            "text": text,
            "pred": preds[i],
            "conf": conf,
            "needs_review": needs_review
        })
    latency = (time.time() - start) / len(texts)
    return results, latency


# --- Run Evaluations ---
texts = eval_df["text"].tolist()
y_true = eval_df["expected_category"].tolist()
styles = eval_df["style"].tolist()

res_tfidf, lat_tfidf = evaluate_tfidf(texts)
res_hybrid, lat_hybrid = evaluate_hybrid(texts)
res_minilm, lat_minilm = evaluate_minilm(texts)

print("\n--- PERFORMANCE METRICS ---")
for name, res_list, lat in [("TF-IDF Only", res_tfidf, lat_tfidf), 
                            ("Rules + TF-IDF", res_hybrid, lat_hybrid), 
                            ("MiniLM + LR", res_minilm, lat_minilm)]:
    y_pred = [r["pred"] for r in res_list]
    acc = accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='weighted', zero_division=0)
    print(f"{name}: Acc={acc:.3f}, P={p:.3f}, R={r:.3f}, F1={f1:.3f} | Latency={lat*1000:.1f}ms/req")

print("\n--- STYLE BREAKDOWN (Accuracy) ---")
styles_unique = list(set(styles))
for style in styles_unique:
    idxs = [i for i, s in enumerate(styles) if s == style]
    y_true_s = [y_true[i] for i in idxs]
    print(f"[{style.upper()}] (n={len(idxs)}):")
    for name, res_list in [("TF-IDF Only", res_tfidf), ("Rules+TFIDF", res_hybrid), ("MiniLM", res_minilm)]:
        y_pred_s = [res_list[i]["pred"] for i in idxs]
        acc = accuracy_score(y_true_s, y_pred_s)
        print(f"  {name}: {acc:.3f}")

print("\n--- HEAD TO HEAD ERROR ANALYSIS ---")
print("Text | Expected | Rules+TF-IDF | MiniLM | Winner")
for i, text in enumerate(texts):
    exp = y_true[i]
    pred_h = res_hybrid[i]["pred"]
    pred_m = res_minilm[i]["pred"]
    if pred_h == exp and pred_m == exp:
        winner = "Tie (Correct)"
    elif pred_h != exp and pred_m != exp:
        winner = "Tie (Wrong)"
    elif pred_h == exp and pred_m != exp:
        winner = "Rules+TF-IDF"
    else:
        winner = "MiniLM"
    
    if winner != "Tie (Correct)":
        print(f"{text[:25]:<25} | {exp:<12} | {pred_h:<12} | {pred_m:<12} | {winner}")

print("\n--- NEEDS_REVIEW THRESHOLD ANALYSIS (Rules+TFIDF) ---")
# Only analyze TF-IDF fallbacks for needsReview evaluation (Rules always false)
tfidf_only_cases = [r for r in res_hybrid if r["source"] == "tfidf"]
if not tfidf_only_cases:
    print("No TF-IDF fallbacks found in evaluation.")
else:
    correct_no_review = 0
    wrong_no_review = 0 # False confidence
    correct_review = 0  # Unnecessary review
    wrong_review = 0
    
    for r in tfidf_only_cases:
        i = texts.index(r["text"])
        exp = y_true[i]
        is_correct = (r["pred"] == exp)
        if r["needs_review"]:
            if is_correct: correct_review += 1
            else: wrong_review += 1
        else:
            if is_correct: correct_no_review += 1
            else: wrong_no_review += 1
            
    print(f"Correct + Needs Review (Unnecessary flag) : {correct_review}")
    print(f"Wrong + Needs Review (Correctly flagged)  : {wrong_review}")
    print(f"Correct + No Review (True confidence)     : {correct_no_review}")
    print(f"Wrong + No Review (False confidence)      : {wrong_no_review}")
