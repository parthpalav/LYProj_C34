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
import numpy as np
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
        self.category_model = None
        self.category_vectorizer = None
        self.type_model = None
        self.type_encoder = None
        self._category_loaded = False
        self._type_loaded = False
        self.minilm_type_available = False

    def load_category(self) -> bool:
        if self._category_loaded and self.category_model is not None:
            return True
            
        # Try new V2 model first
        model_path = os.path.join(self.base_dir, "tfidf_v2_category_model.pkl")
        vectorizer_path = os.path.join(self.base_dir, "tfidf_v2_category_vectorizer.pkl")
        self.category_source_name = "tfidf_v2"
        
        if not (os.path.exists(model_path) and os.path.exists(vectorizer_path)):
            # Fall back to legacy models
            model_path = os.path.join(self.base_dir, "classifier_model.pkl")
            vectorizer_path = os.path.join(self.base_dir, "tfidf_vectorizer.pkl")
            self.category_source_name = "tfidf"
            
        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            with open(model_path, "rb") as f:
                self.category_model = pickle.load(f)
            with open(vectorizer_path, "rb") as f:
                self.category_vectorizer = pickle.load(f)
            self._category_loaded = True
            log.info(f"✅ Category Model ({self.category_source_name}) loaded successfully in HybridPipeline")
            return True
            
        log.error("❌ No Category Model found for HybridPipeline!")
        return False

    def load_type(self) -> bool:
        if self._type_loaded and self.type_model is not None:
            return True
            
        model_path = os.path.join(self.base_dir, "minilm_v2_type_model.pkl")
        if os.path.exists(model_path):
            try:
                import joblib
                from sentence_transformers import SentenceTransformer
                
                log.info("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
                self.type_encoder = SentenceTransformer("all-MiniLM-L6-v2")
                self.type_model = joblib.load(model_path)
                self.minilm_type_available = True
                self._type_loaded = True
                log.info("✅ MiniLM Type Head loaded successfully in HybridPipeline")
                return True
            except Exception as e:
                log.warning(f"⚠️ Failed to load MiniLM Type model or encoder: {e}")
                self.minilm_type_available = False
                return False
        else:
            log.warning("⚠️ minilm_v2_type_model.pkl not found for HybridPipeline")
            self.minilm_type_available = False
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
                "categoryConfidence": 0.0,
                "typeConfidence": 0.0,
                "all_probs": {},
                "classificationSource": "fallback",
                "categorySource": "fallback",
                "typeSource": "fallback",
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
            
            category_source = "merchant_rule"
            type_source = "merchant_rule"
            category_conf = confidence
            type_conf = confidence
            needs_review = False
            log.info(f"HybridClassifier [merchant_rule]: '{raw}' -> {category} ({spend_type}, {confidence*100:.0f}%)")

        # ── Step 2: Fallback to ML / TF-IDF for Category and MiniLM for Type ──
        else:
            # 2a. Category Classification
            if not self.load_category():
                return {
                    "error": "Category Model not loaded",
                    "category": "Misc",
                    "type": "Need",
                    "confidence": 0.0,
                    "confidenceScore": 0.0,
                    "categoryConfidence": 0.0,
                    "typeConfidence": 0.0,
                    "all_probs": {},
                    "classificationSource": "fallback",
                    "categorySource": "fallback",
                    "typeSource": "fallback",
                    "needsReview": True,
                    "flagged_for_review": True,
                    "sentiment": "neutral",
                    "sentiment_emoji": "🔵",
                    "sentiment_label": "Neutral Spend",
                    "verdict": "Classifier not loaded."
                }

            cleaned = clean_tfidf_text(raw)
            vec = self.category_vectorizer.transform([cleaned])
            category = self.category_model.predict(vec)[0]
            probs = self.category_model.predict_proba(vec)[0]
            category_conf = float(probs.max())
            all_probs = {cls: round(float(p), 4) for cls, p in zip(self.category_model.classes_, probs)}
            category_source = self.category_source_name

            sorted_probs = sorted(probs, reverse=True)
            margin = (sorted_probs[0] - sorted_probs[1]) if len(sorted_probs) > 1 else 1.0
            category_needs_review = (category_conf < 0.60) or (margin < 0.15)

            # 2b. Type Classification
            self.load_type()
            if self.minilm_type_available and self.type_model is not None:
                try:
                    # Run MiniLM Type inference
                    emb = self.type_encoder.encode([raw], show_progress_bar=False)
                    type_probs = self.type_model.predict_proba(emb)[0]
                    predicted_type_idx = np.argmax(type_probs)
                    spend_type = self.type_model.classes_[predicted_type_idx]
                    type_conf = float(type_probs[predicted_type_idx])
                    type_source = "minilm"
                    
                    # Apply frozen 0.75 confidence policy
                    type_needs_review = type_conf < 0.75
                except Exception as e:
                    log.warning(f"⚠️ MiniLM type prediction failed: {e}. Falling back to default map.")
                    spend_type = CATEGORY_TYPE_MAP.get(category, "Need")
                    type_conf = category_conf
                    type_source = "fallback"
                    type_needs_review = True
            else:
                # Fallback to category-type map
                spend_type = CATEGORY_TYPE_MAP.get(category, "Need")
                type_conf = category_conf
                type_source = "fallback"
                type_needs_review = True

            needs_review = category_needs_review or type_needs_review
            log.info(f"HybridClassifier [ML Fallback]: '{raw}' -> {category} (Conf: {category_conf*100:.1f}%, Source: {category_source}) | Type: {spend_type} (Conf: {type_conf*100:.1f}%, Source: {type_source}) | needsReview={needs_review}")

        # ── Step 3: Build Sentiment & Metadata ─────────────────────────────────
        sentiment = CATEGORY_SENTIMENT.get(category, "neutral")
        meta = SENTIMENT_META[sentiment]

        return {
            "category":             category,
            "type":                 spend_type,
            "confidence":           round(category_conf, 4),
            "confidenceScore":      round(category_conf, 4),
            "categoryConfidence":   round(category_conf, 4),
            "typeConfidence":       round(type_conf, 4),
            "all_probs":            all_probs,
            "classificationSource": category_source,
            "categorySource":       category_source,
            "typeSource":           type_source,
            "needsReview":          needs_review,
            "flagged_for_review":   needs_review,
            "sentiment":            sentiment,
            "sentiment_emoji":      meta["emoji"],
            "sentiment_label":      meta["label"],
            "verdict":              meta["verdict"],
        }
