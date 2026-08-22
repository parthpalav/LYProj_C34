"""
classifier/minilm_inference.py
------------------------------
Phase 6: Inference module for the fine-tuned MiniLM classifier.
Provides a clean interface for predicting categories from transaction text,
including probability scores and explicit ambiguity handling.
"""

import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models", "minilm-finaura")

class MiniLMClassifier:
    def __init__(self, model_path=MODEL_DIR):
        self.model_path = model_path
        self.tokenizer = None
        self.model = None
        self.is_loaded = False
        
    def load(self):
        """Lazy load the model and tokenizer to save memory until needed."""
        if self.is_loaded:
            return
            
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model directory not found at {self.model_path}. Train the model first.")
            
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_path)
        self.model.eval()  # Set to evaluation mode
        
        # Use MPS/GPU if available (for latency optimization)
        self.device = torch.device("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.is_loaded = True
        
    def predict(self, text: str) -> dict:
        """
        Predict the category for a transaction description.
        
        Returns:
            dict containing:
            - category (str)
            - confidence (float)
            - flagged_for_review (bool)
        """
        if not self.is_loaded:
            self.load()
            
        # Clean text basic
        text = str(text).strip()
        if not text:
            return {
                "category": "Misc",
                "confidence": 0.0,
                "flagged_for_review": True
            }
            
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=64).to(self.device)
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
            
        max_prob, predicted_class = torch.max(probs, dim=-1)
        prob_val = max_prob.item()
        
        # Get category label from model config
        category = self.model.config.id2label[predicted_class.item()]
        
        # Flag for review if confidence is low or it's implicitly ambiguous (Misc)
        is_low_confidence = prob_val < 0.60
        is_misc = category == "Misc"
        
        return {
            "category": category,
            "confidence": round(prob_val, 4),
            "flagged_for_review": is_low_confidence or is_misc
        }

# Global singleton for the API
classifier_instance = MiniLMClassifier()

def predict_transaction(text: str) -> dict:
    """Convenience wrapper for the global singleton."""
    return classifier_instance.predict(text)
