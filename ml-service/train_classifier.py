"""
train_classifier.py
-------------------
Trains a TF-IDF + Logistic Regression model for expense categorisation.
Categories: Food, Travel, Entertainment, Shopping, Bills,
            Groceries, Health, Party, Education, Misc

Run:
    python train_classifier.py

Outputs:
    classifier_model.pkl
    tfidf_vectorizer.pkl
"""

import os
import re
import pickle

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report

# ─── 1. Load dataset ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
df = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv"))

# Drop rows with missing values
df = df.dropna(subset=["text", "category"])
df["text"] = df["text"].astype(str).str.strip()
df["category"] = df["category"].astype(str).str.strip()

print(f"[OK] Dataset loaded: {len(df)} rows")
print(f"     Categories: {sorted(df['category'].unique())}\n")

# ─── 2. Preprocessing helper ──────────────────────────────────────────────────
def clean_text(text: str) -> str:
    """Lowercase, remove currency symbols/numbers, strip extra spaces."""
    text = text.lower()
    # remove currency prefixes like "500rs", "₹200", "rs 300"
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", text)
    # remove standalone numbers
    text = re.sub(r"\b\d+\b", " ", text)
    # remove punctuation except spaces
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

df["clean"] = df["text"].apply(clean_text)

# ─── 3. Features & Labels ────────────────────────────────────────────────────
X = df["clean"]
y = df["category"]

# ─── 4. TF-IDF ────────────────────────────────────────────────────────────────
vectorizer = TfidfVectorizer(
    lowercase=True,
    stop_words="english",
    ngram_range=(1, 2),
    max_features=5000,
    sublinear_tf=True,
)

X_tfidf = vectorizer.fit_transform(X)

# ─── 5. Logistic Regression (train on ALL data since dataset is small) ────────
model = LogisticRegression(
    max_iter=500,
    solver="lbfgs",
    C=5.0,
    class_weight="balanced",
)
model.fit(X_tfidf, y)

# ─── 6. Evaluate (in-sample accuracy) ────────────────────────────────────────
y_pred = model.predict(X_tfidf)
acc = accuracy_score(y, y_pred)

print(f"[RESULT] Accuracy : {acc * 100:.1f}%\n")
print("[REPORT] Classification Report:")
print(classification_report(y, y_pred, zero_division=0))

# ─── 7. Quick smoke-test ──────────────────────────────────────────────────────
test_inputs = [
    "500rs Pizza",
    "200rs Book",
    "900rs Drinks",
    "1000rs Electricity bill",
    "799rs Dress",
    "uber ride",
    "netflix subscription",
    "gym membership",
    "birthday party",
    "vegetable shopping",
]

print("[SMOKE TEST]")
for text in test_inputs:
    cleaned = clean_text(text)
    vec     = vectorizer.transform([cleaned])
    pred    = model.predict(vec)[0]
    probs   = model.predict_proba(vec)[0]
    conf    = probs.max() * 100
    print(f"   '{text}' --> {pred}  ({conf:.0f}%)")

# ─── 8. Save model ────────────────────────────────────────────────────────────
model_path      = os.path.join(BASE_DIR, "classifier_model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")

with open(model_path, "wb") as f:
    pickle.dump(model, f)

with open(vectorizer_path, "wb") as f:
    pickle.dump(vectorizer, f)

print(f"\n[SAVED] Model      --> {model_path}")
print(f"[SAVED] Vectorizer --> {vectorizer_path}")
print("\n[DONE] Training complete! Run 'python api.py' to start the Flask service.")
