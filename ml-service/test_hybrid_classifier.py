"""
test_hybrid_classifier.py
Unit and integration tests for FINAURA Hybrid Classifier (V3 Taxonomy).

Validates:
1. Deterministic Merchant / Rule Layer matches known patterns across all 14 V3 categories.
2. Case-insensitivity, amount noise handling, and boundary phrase safety.
3. Fallback to TF-IDF with 14 classes probability distribution.
4. Canonical investments and regression safety.
5. Strict separation between Type (Need/Want/Investment) and Category (14 classes).
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

    def test_merchant_rules_v3_categories(self):
        cases = [
            ("Zomato dinner order", "Food & Dining", "Want"),
            ("₹450 swiggy pizza", "Food & Dining", "Want"),
            ("McDonald's meal", "Food & Dining", "Want"),
            ("Starbucks coffee", "Food & Dining", "Want"),
            ("Blinkit weekly groceries", "Groceries", "Need"),
            ("DMart monthly groceries", "Groceries", "Need"),
            ("Mumbai Metro card recharge 500rs", "Transport & Travel", "Need"),
            ("Uber ride home", "Transport & Travel", "Want"),
            ("Monthly house rent payment", "Housing", "Need"),
            ("Building society maintenance charges", "Housing", "Need"),
            ("Electricity bill payment ₹3400", "Utilities & Bills", "Need"),
            ("Airtel broadband wifi bill", "Utilities & Bills", "Need"),
            ("Home loan emi monthly payment", "Debt & Loan Payments", "Need"),
            ("HDFC credit card bill payment", "Debt & Loan Payments", "Need"),
            ("Star health insurance premium", "Insurance", "Need"),
            ("Max life term insurance policy", "Insurance", "Need"),
            ("Haircut and beard trim salon", "Personal Care", "Want"),
            ("Urban company salon facial at home", "Personal Care", "Want"),
            ("Apollo pharmacy medicines", "Health", "Need"),
            ("Doctor consultation fee", "Health", "Need"),
            ("Coursera machine learning course", "Education", "Investment"),
            ("College tuition semester fees", "Education", "Investment"),
            ("Zerodha mutual fund SIP ₹5000", "Investments", "Investment"),
            ("Netflix monthly subscription", "Entertainment", "Want"),
            ("BookMyShow movie tickets PVR", "Entertainment", "Want"),
            ("Amazon order wireless headphones", "Shopping", "Want"),
            ("Zara casual cotton shirt", "Shopping", "Want"),
        ]
        for text, expected_cat, expected_type in cases:
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, f"Rule should match: {text}")
            self.assertEqual(res["category"], expected_cat, f"Category mismatch for '{text}'")
            self.assertEqual(res["type"], expected_type, f"Type mismatch for '{text}'")
            self.assertEqual(res["classificationSource"], "merchant_rule")
            self.assertFalse(res["needsReview"])
            self.assertGreaterEqual(res["confidence"], 0.90)

    def test_canonical_investments(self):
        investment_cases = [
            ("Nifty50", "Investments", "Investment"),
            ("Nifty 50 SIP", "Investments", "Investment"),
            ("Nvidia shares", "Investments", "Investment"),
            ("Bought Apple stock", "Investments", "Investment"),
            ("SBI Nifty Index Fund", "Investments", "Investment"),
            ("HDFC Mutual Fund SIP", "Investments", "Investment"),
            ("Zerodha equity purchase", "Investments", "Investment"),
            ("Groww mutual fund", "Investments", "Investment"),
            ("NPS contribution", "Investments", "Investment"),
            ("PPF deposit", "Investments", "Investment"),
            ("Government bond purchase", "Investments", "Investment"),
            ("ETF investment", "Investments", "Investment"),
        ]
        for text, expected_cat, expected_type in investment_cases:
            res = self.classifier.classify(text)
            self.assertEqual(res["category"], expected_cat, f"Category mismatch for '{text}': got {res['category']}")
            self.assertEqual(res["type"], expected_type, f"Type mismatch for '{text}': got {res['type']}")

    def test_all_14_categories_end_to_end(self):
        v3_cases = [
            ("Swiggy biryani", "Food & Dining", "Want"),
            ("Blinkit milk and eggs", "Groceries", "Need"),
            ("Uber cab ride", "Transport & Travel", "Want"),
            ("Monthly flat rent", "Housing", "Need"),
            ("Electricity bill", "Utilities & Bills", "Need"),
            ("Car loan emi installment", "Debt & Loan Payments", "Need"),
            ("New shoes shopping", "Shopping", "Want"),
            ("Netflix subscription", "Entertainment", "Want"),
            ("Doctor consultation", "Health", "Need"),
            ("College tuition", "Education", "Investment"),
            ("Haircut and hair wash", "Personal Care", "Want"),
            ("Health insurance premium", "Insurance", "Need"),
            ("Nifty 50 mutual fund SIP", "Investments", "Investment"),
            ("Miscellaneous cash expense", "Misc", "Need"),
        ]
        for text, expected_cat, expected_type in v3_cases:
            res = self.classifier.classify(text)
            self.assertEqual(res["category"], expected_cat, f"Category mismatch for '{text}'")
            self.assertEqual(res["type"], expected_type, f"Type mismatch for '{text}'")

    def test_ambiguous_phrase_safety(self):
        cases = [
            "share dinner bill",
            "share cab fare",
            "stock up on groceries",
            "stock photos subscription",
            "equity in my home",
            "bond with friends",
            "security deposit for apartment",
            "securities exam course",
            "Apple Store purchase",
        ]
        for text in cases:
            res = self.classifier.classify(text)
            self.assertNotEqual(res["category"], "Investments", f"'{text}' falsely classified as Investments: got {res['category']} ({res['classificationSource']})")

    def test_nifty50_and_nvidia_shares_bug_regression(self):
        """CRITICAL: Ensure Nifty50 and Nvidia shares NEVER return Food & Dining."""
        for text in ["Nifty50", "Nifty 50", "Nvidia shares", "nvidia shares", "Bought Apple stock"]:
            res = self.classifier.classify(text)
            self.assertNotEqual(res["category"], "Food & Dining", f"CRITICAL BUG: '{text}' returned Food & Dining!")
            self.assertEqual(res["category"], "Investments")
            self.assertEqual(res["type"], "Investment")

    def test_unresolved_falls_through_to_tfidf_14_classes(self):
        ambiguous_text = "project supplies and general hardware accessories"
        rule_res = match_merchant_rule(ambiguous_text)
        self.assertIsNone(rule_res, "Ambiguous text should NOT trigger a deterministic rule")

        res = self.classifier.classify(ambiguous_text)
        self.assertEqual(res["classificationSource"], "tfidf_v2")
        self.assertIn("all_probs", res)
        self.assertIsInstance(res["all_probs"], dict)
        self.assertEqual(len(res["all_probs"]), 14, "TF-IDF should return full probability distribution for 14 classes")
        self.assertIn("Housing", res["all_probs"])
        self.assertIn("Debt & Loan Payments", res["all_probs"])
        self.assertIn("Personal Care", res["all_probs"])
        self.assertIn("Insurance", res["all_probs"])
        self.assertIn("Investments", res["all_probs"])

    def test_full_contract_compatibility(self):
        test_inputs = [
            "Zomato burger",
            "Uber ride",
            "Monthly rent",
            "Car loan emi",
            "Star health insurance",
            "Salon haircut",
            "Nifty50 SIP",
            "General miscellaneous payment"
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

if __name__ == "__main__":
    unittest.main()
