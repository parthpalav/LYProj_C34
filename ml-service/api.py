"""
ml-service/api.py
Flask ML microservice — runs on port 5001

Endpoints:
  GET  /health          → service health check
  POST /sentiment       → rule-based sentiment score
  POST /fmi             → Financial Momentum Index computation
  POST /predict         → spending threshold alerts
  POST /classify        → TF-IDF + LogReg expense categorisation  ← NEW
"""

import os
import re
import pickle
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS

from fmi_model import compute_fmi
from predictor import detect_threshold_alerts
from sentiment import score_sentiment

# ─── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # allow Express server to call this service

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ─── Load TF-IDF classifier (lazy, won't crash if not trained yet) ─────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
_model      = None
_vectorizer = None

def _load_classifier():
    global _model, _vectorizer
    if _model is not None:
        return True
    model_path      = os.path.join(BASE_DIR, "classifier_model.pkl")
    vectorizer_path = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
    if os.path.exists(model_path) and os.path.exists(vectorizer_path):
        with open(model_path, "rb") as f:
            _model = pickle.load(f)
        with open(vectorizer_path, "rb") as f:
            _vectorizer = pickle.load(f)
        log.info("✅ Classifier loaded successfully")
        return True
    log.warning("⚠️  classifier_model.pkl not found — run train_classifier.py first")
    return False


def _clean_text(text: str) -> str:
    """Mirror of the same cleaning used during training."""
    text = text.lower()
    # remove currency prefixes like "500rs", "₹200", "rs 300"
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", text)
    # remove standalone numbers
    text = re.sub(r"\b\d+\b", " ", text)
    # remove punctuation except spaces
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ─── Existing endpoints ───────────────────────────────────────────────────────

@app.get('/health')
def health():
    classifier_ready = _load_classifier()
    return jsonify({
        'ok': True,
        'service': 'ml-service',
        'classifier_ready': classifier_ready
    })


@app.post('/sentiment')
def sentiment_endpoint():
    payload = request.get_json(force=True)
    text    = payload.get('text', '')
    score   = score_sentiment(text)
    return jsonify({'score': score})


@app.post('/fmi')
def fmi_endpoint():
    payload = request.get_json(force=True)
    score   = compute_fmi(
        sentiment          = float(payload.get('sentiment', 0.0)),
        spending_deviation = float(payload.get('spending_deviation', 0.0)),
        income_stability   = float(payload.get('income_stability', 0.0)),
        upcoming_bills     = float(payload.get('upcoming_bills', 0.0)),
    )
    return jsonify({'score': score})


@app.post('/predict')
def predict_endpoint():
    payload    = request.get_json(force=True)
    series     = payload.get('spending_series', [])
    balance    = float(payload.get('balance', 0))
    prediction = detect_threshold_alerts(series, balance)
    return jsonify(prediction)


# ─── NEW: Expense Categorisation + Sentiment ──────────────────────────────────

# Sentiment rules based on category
# negative  → discretionary / impulsive spending (bad for finances)
# neutral   → necessary / unavoidable spending
# positive  → investment in self / future
_CATEGORY_SENTIMENT: dict[str, str] = {
    "Food":          "negative",    # often discretionary / eating out
    "Travel":        "neutral",     # could be work or leisure
    "Entertainment": "negative",    # pure discretionary
    "Shopping":      "negative",    # often impulsive
    "Bills":         "neutral",     # necessary / unavoidable
    "Groceries":     "neutral",     # necessary household expense
    "Health":        "positive",    # investment in wellbeing
    "Party":         "negative",    # discretionary social spending
    "Education":     "positive",    # investment in skills/growth
    "Misc":          "neutral",     # unknown — don't penalise
}

_SENTIMENT_META = {
    "positive": {"emoji": "💚", "label": "Good Spend",   "verdict": "This is a healthy investment in yourself!"},
    "neutral":  {"emoji": "🔵", "label": "Neutral Spend", "verdict": "Necessary expense — keep it within budget."},
    "negative": {"emoji": "🔴", "label": "Watch Out",    "verdict": "Discretionary spend — think before you pay!"},
}


@app.post('/classify')
def classify_expense():
    """
    POST /classify
    Body: { "text": "500rs pizza" }

    Response:
    {
      "category":       "Food",
      "confidence":     0.92,
      "all_probs":      { "Food": 0.92, "Travel": 0.02, ... },
      "sentiment":      "negative",
      "sentiment_emoji": "🔴",
      "sentiment_label": "Watch Out",
      "verdict":        "Discretionary spend — think before you pay!"
    }
    """
    if not _load_classifier():
        return jsonify({
            "error": "Model not trained yet. Run train_classifier.py first.",
            "category": "Misc",
            "confidence": 0.0,
            "all_probs": {},
            "sentiment": "neutral",
            "sentiment_emoji": "🔵",
            "sentiment_label": "Neutral Spend",
            "verdict": "Could not classify."
        }), 503

    payload = request.get_json(force=True)
    raw     = payload.get('text', '').strip()

    if not raw:
        return jsonify({
            "error": "No text provided",
            "category": "Misc",
            "confidence": 0.0,
            "all_probs": {},
            "sentiment": "neutral",
            "sentiment_emoji": "🔵",
            "sentiment_label": "Neutral Spend",
            "verdict": "No input provided."
        }), 400

    cleaned    = _clean_text(raw)
    vec        = _vectorizer.transform([cleaned])
    category   = _model.predict(vec)[0]
    probs      = _model.predict_proba(vec)[0]
    confidence = float(probs.max())
    all_probs  = {cls: round(float(p), 4) for cls, p in zip(_model.classes_, probs)}

    # Derive sentiment from predicted category
    sentiment    = _CATEGORY_SENTIMENT.get(category, "neutral")
    meta         = _SENTIMENT_META[sentiment]

    log.info(f"classify: '{raw}' -> {category} ({confidence*100:.0f}%) | sentiment: {sentiment}")

    return jsonify({
        "category":        category,
        "confidence":      confidence,
        "all_probs":       all_probs,
        "sentiment":       sentiment,
        "sentiment_emoji": meta["emoji"],
        "sentiment_label": meta["label"],
        "verdict":         meta["verdict"],
    })


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    _load_classifier()   # pre-load on startup
    app.run(host='0.0.0.0', port=5001, debug=True)
