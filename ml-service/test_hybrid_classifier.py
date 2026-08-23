"""
test_hybrid_classifier.py
Unit and integration tests for Phase 1 Hybrid Classifier architecture.

Validates:
1. Deterministic Merchant / Rule Layer matches known patterns with high confidence.
2. Case-insensitivity and currency noise handling.
3. Unresolved/ambiguous descriptions fall through cleanly to TF-IDF.
4. TF-IDF preserves existing predictions, probability distributions, and contracts.
5. classificationSource metadata ('merchant_rule' vs 'tfidf').
6. needsReview / flagged_for_review uncertainty handling.
7. Output contract compatibility.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from classifier.rules import match_merchant_rule
from classifier.hybrid_pipeline import HybridClassifier

class TestHybridClassifier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classifier = HybridClassifier(BASE_DIR)

    def test_merchant_rules_food(self):
        cases = [
            ("Zomato dinner order", "Food", "Want"),
            ("₹450 swiggy pizza", "Food", "Want"),
            ("McDonald's meal", "Food", "Want"),
            ("Starbucks coffee", "Food", "Want"),
            ("Dominos pizza party", "Food", "Want"),
        ]
        for text, expected_cat, expected_type in cases:
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, f"Rule should match: {text}")
            self.assertEqual(res["category"], expected_cat)
            self.assertEqual(res["type"], expected_type)
            self.assertEqual(res["classificationSource"], "merchant_rule")
            self.assertFalse(res["needsReview"])
            self.assertGreaterEqual(res["confidence"], 0.90)

    def test_merchant_rules_transport(self):
        # Public transit -> Need
        transit_cases = [
            ("Mumbai Metro card recharge 500rs", "Travel", "Need"),
            ("Delhi Metro commute", "Travel", "Need"),
            ("Local train pass renewal", "Travel", "Need"),
            ("Monthly bus pass", "Travel", "Need"),
        ]
        for text, expected_cat, expected_type in transit_cases:
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, f"Rule should match transit: {text}")
            self.assertEqual(res["category"], expected_cat)
            self.assertEqual(res["type"], expected_type)
            self.assertEqual(res["classificationSource"], "merchant_rule")

        # Cabs / flights -> Want
        cab_cases = [
            ("Uber ride home", "Travel", "Want"),
            ("Ola cab booking", "Travel", "Want"),
            ("Indigo airlines flight ticket", "Travel", "Want"),
        ]
        for text, expected_cat, expected_type in cab_cases:
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, f"Rule should match cab: {text}")
            self.assertEqual(res["category"], expected_cat)
            self.assertEqual(res["type"], expected_type)
            self.assertEqual(res["classificationSource"], "merchant_rule")

    def test_merchant_rules_bills_groceries_health(self):
        cases = [
            ("Electricity bill payment ₹3400", "Bills", "Need"),
            ("Airtel broadband wifi bill", "Bills", "Need"),
            ("Blinkit weekly groceries", "Groceries", "Need"),
            ("Zepto quick grocery delivery", "Groceries", "Need"),
            ("Apollo pharmacy medicines", "Health", "Need"),
            ("Doctor consultation fee", "Health", "Need"),
            ("Zerodha mutual fund SIP ₹5000", "Misc", "Investment"),
            ("Coursera machine learning course", "Education", "Investment"),
            ("Netflix monthly subscription", "Entertainment", "Want"),
        ]
        for text, expected_cat, expected_type in cases:
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, f"Rule should match: {text}")
            self.assertEqual(res["category"], expected_cat)
            self.assertEqual(res["type"], expected_type)
            self.assertEqual(res["classificationSource"], "merchant_rule")

    def test_unresolved_falls_through_to_tfidf(self):
        # Text without clear merchant keywords
        ambiguous_text = "project supplies and general hardware accessories"
        rule_res = match_merchant_rule(ambiguous_text)
        self.assertIsNone(rule_res, "Ambiguous text should NOT trigger a deterministic rule")

        # Hybrid pipeline should evaluate it with TF-IDF
        res = self.classifier.classify(ambiguous_text)
        self.assertEqual(res["classificationSource"], "tfidf_v2")
        self.assertIn("category", res)
        self.assertIn("confidence", res)
        self.assertIn("all_probs", res)
        self.assertIsInstance(res["all_probs"], dict)
        self.assertGreater(len(res["all_probs"]), 1, "TF-IDF should return full probability distribution")

    def test_full_contract_compatibility(self):
        test_inputs = [
            "Zomato burger",
            "Uber ride",
            "General office paper work",
            "Apollo pharmacy tablets"
        ]
        expected_keys = {
            "category", "type", "confidence", "confidenceScore",
            "all_probs", "classificationSource", "needsReview",
            "flagged_for_review", "sentiment", "sentiment_emoji",
            "sentiment_label", "verdict"
        }
        for inp in test_inputs:
            res = self.classifier.classify(inp)
            for key in expected_keys:
                self.assertIn(key, res, f"Response must contain key: {key}")
            self.assertIsInstance(res["confidence"], float)
            self.assertIsInstance(res["confidenceScore"], float)
            self.assertIn(res["type"], ["Need", "Want", "Investment"])
            self.assertIn(res["sentiment"], ["positive", "neutral", "negative"])
            self.assertIsInstance(res["needsReview"], bool)
            self.assertEqual(res["needsReview"], res["flagged_for_review"])

if __name__ == "__main__":
    unittest.main()
