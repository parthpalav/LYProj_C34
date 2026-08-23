"""
hybrid_pipeline.py
Unified Classification Pipeline for FINAURA.

Orchestration:
1. Deterministic Merchant / Rule Layer (rules.py)
2. Statistical Fallback: TF-IDF + Logistic Regression (legacy model)
3. (Future): Semantic Embeddings / MiniLM Layer

Contract:
- category: str (Canonical FINAURA category)
- type: 'Need' | 'Want' | 'Investment'
- confidence: float (0.0 to 1.0)
- confidenceScore: float (0.0 to 1.0)
- all_probs: dict[str, float]
- classificationSource: 'merchant_rule' | 'tfidf' | 'fallback'
- needsReview: bool
- flagged_for_review: bool
- sentiment: 'positive' | 'neutral' | 'negative'
- sentiment_emoji: str
- sentiment_label: str
- verdict: str
"""

import os
import re
import pickle
import logging
from typing import Dict, Any, Optional

from classifier.rules import match_merchant_rule

log = logging.getLogger(__name__)

# Category → Sentiment mapping
CATEGORY_SENTIMENT: Dict[str, str] = {
    "Food":          "negative",    # often discretionary / dining out
    "Travel":        "neutral",     # contextual
    "Entertainment": "negative",    # discretionary leisure
    "Shopping":      "negative",    # discretionary goods
    "Bills":         "neutral",     # necessary utility/obligation
    "Groceries":     "neutral",     # necessary household sustenance
    "Health":        "positive",    # investment in wellbeing / essential
    "Party":         "negative",    # discretionary nightlife
    "Education":     "positive",    # investment in self/future
    "Misc":          "neutral",     # neutral baseline
}

SENTIMENT_META = {
    "positive": {"emoji": "💚", "label": "Good Spend",   "verdict": "This is a healthy investment in yourself!"},
    "neutral":  {"emoji": "🔵", "label": "Neutral Spend", "verdict": "Necessary expense — keep it within budget."},
    "negative": {"emoji": "🔴", "label": "Watch Out",    "verdict": "Discretionary spend — think before you pay!"},
}

# Category → Default Type mapping (used when TF-IDF predicts category without explicit type)
CATEGORY_TYPE_MAP: Dict[str, str] = {
    "Food": "Want",
    "Travel": "Want",
    "Entertainment": "Want",
    "Shopping": "Want",
    "Bills": "Need",
    "Groceries": "Need",
    "Health": "Need",          # Fixed: Essential medical is a Need
    "Party": "Want",
    "Education": "Investment",  # Human capital investment
    "Misc": "Need",
}


def clean_tfidf_text(text: str) -> str:
    """Mirror of the cleaning used during TF-IDF training."""
    text = text.lower()
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+|\d+\s*(₹|rs\.?|inr)", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


class HybridClassifier:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.model = None
        self.vectorizer = None
        self._loaded = False

    def load_tfidf(self) -> bool:
        if self._loaded and self.model is not None:
            return True
        model_path = os.path.join(self.base_dir, "classifier_model.pkl")
        vectorizer_path = os.path.join(self.base_dir, "tfidf_vectorizer.pkl")
        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            with open(vectorizer_path, "rb") as f:
                self.vectorizer = pickle.load(f)
            self._loaded = True
            log.info("✅ TF-IDF Classifier loaded successfully in HybridPipeline")
            return True
        log.warning("⚠️ classifier_model.pkl not found for HybridPipeline")
        return False

    def classify(self, raw_text: str) -> Dict[str, Any]:
        raw = (raw_text or "").strip()
        if not raw:
            return {
                "error": "No text provided",
                "category": "Misc",
                "type": "Need",
                "confidence": 0.0,
                "confidenceScore": 0.0,
                "all_probs": {},
                "classificationSource": "fallback",
                "needsReview": True,
                "flagged_for_review": True,
                "sentiment": "neutral",
                "sentiment_emoji": "🔵",
                "sentiment_label": "Neutral Spend",
                "verdict": "No input provided."
            }

        # ── Step 1: Deterministic Merchant / Rule Layer ────────────────────────
        rule_match = match_merchant_rule(raw)
        if rule_match is not None:
            category = rule_match["category"]
            spend_type = rule_match["type"]
            confidence = rule_match["confidence"]
            all_probs = {category: round(confidence, 4)}
            source = "merchant_rule"
            needs_review = False
            log.info(f"HybridClassifier [merchant_rule]: '{raw}' -> {category} ({spend_type}, {confidence*100:.0f}%)")

        # ── Step 2: TF-IDF + Logistic Regression Statistical Fallback ──────────
        else:
            if not self.load_tfidf():
                return {
                    "error": "Model not loaded",
                    "category": "Misc",
                    "type": "Need",
                    "confidence": 0.0,
                    "confidenceScore": 0.0,
                    "all_probs": {},
                    "classificationSource": "fallback",
                    "needsReview": True,
                    "flagged_for_review": True,
                    "sentiment": "neutral",
                    "sentiment_emoji": "🔵",
                    "sentiment_label": "Neutral Spend",
                    "verdict": "Classifier not loaded."
                }

            cleaned = clean_tfidf_text(raw)
            vec = self.vectorizer.transform([cleaned])
            category = self.model.predict(vec)[0]
            probs = self.model.predict_proba(vec)[0]
            confidence = float(probs.max())
            all_probs = {cls: round(float(p), 4) for cls, p in zip(self.model.classes_, probs)}
            spend_type = CATEGORY_TYPE_MAP.get(category, "Need")
            source = "tfidf"

            # Uncertainty / Review criteria for statistical model:
            # Low confidence (< 0.60) or close top predictions
            sorted_probs = sorted(probs, reverse=True)
            margin = (sorted_probs[0] - sorted_probs[1]) if len(sorted_probs) > 1 else 1.0
            needs_review = (confidence < 0.60) or (margin < 0.15)
            log.info(f"HybridClassifier [tfidf]: '{raw}' -> {category} ({spend_type}, {confidence*100:.0f}%, needsReview={needs_review})")

        # ── Step 3: Build Sentiment & Metadata ─────────────────────────────────
        sentiment = CATEGORY_SENTIMENT.get(category, "neutral")
        meta = SENTIMENT_META[sentiment]

        return {
            "category":             category,
            "type":                 spend_type,
            "confidence":           round(confidence, 4),
            "confidenceScore":      round(confidence, 4),
            "all_probs":            all_probs,
            "classificationSource": source,
            "needsReview":          needs_review,
            "flagged_for_review":   needs_review,
            "sentiment":            sentiment,
            "sentiment_emoji":      meta["emoji"],
            "sentiment_label":      meta["label"],
            "verdict":              meta["verdict"],
        }
