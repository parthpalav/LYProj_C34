"""
test_normalize_rules.py
1. Bank-string normalisation (UPI / POS / NEFT / IMPS) used by rules and the v4 model.
2. Regression: rule false positives found in the v4 audit must not fire.
3. Every pipeline output is a valid (category, type) pair.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from classifier.normalize import clean_text
from classifier.rules import match_merchant_rule
from classifier.category_map import ALLOWED_TYPES
from classifier.hybrid_pipeline import HybridClassifier


class TestNormalize(unittest.TestCase):
    def test_bank_strings(self):
        cases = {
            "UPI/DR/412345678/RAMESH KIRANA/okaxis": "ramesh kirana",
            "UPI-UPSTOX-782577@upi": "upstox",
            "POS 4521 RELIANCE SMART": "reliance smart",
            "BIL/ONL/000123456789/AIRTEL POSTPAID/HDFC": "airtel postpaid",
            "FAASOS TXN POS PURCHASE": "faasos",
            "IMPS/P2A/309812345678/MOM/SBIN0001234": "mom",
            "paid zomato.order@hdfcbank 450": "paid zomato order",
        }
        for raw, expected in cases.items():
            self.assertEqual(clean_text(raw), expected, raw)

    def test_typed_text_keeps_words(self):
        self.assertEqual(clean_text("Dr Lal Pathlabs blood test"), "dr lal pathlabs blood test")
        self.assertEqual(clean_text("Zomato dinner order ₹450"), "zomato dinner order")
        self.assertEqual(clean_text("500rs Pizza order"), "pizza order")
        self.assertEqual(clean_text(""), "")


class TestRuleFalsePositives(unittest.TestCase):
    def test_ambiguous_words_do_not_fire(self):
        for text in ["samsung galaxy tablet", "sip of coffee at third wave", "gaming chair", "dhanlaxmi sweets"]:
            self.assertIsNone(match_merchant_rule(text), text)

    def test_contextual_versions_still_fire(self):
        cases = {
            "paracetamol tablets": "Health",
            "sip investment": "Investments",
            "dhan app": "Investments",
            "gaming subscription": "Entertainment",
            "amazon prime": "Entertainment",
            "x-ray": "Health",
        }
        for text, cat in cases.items():
            res = match_merchant_rule(text)
            self.assertIsNotNone(res, text)
            self.assertEqual(res["category"], cat, text)

    def test_rubric_boundaries(self):
        # (text) -> (category, type) per data/CATEGORY_RUBRIC.md; None = left to the model
        cases = {
            "board game cafe entry": ("Entertainment", "Want"),
            "star sports cafe": ("Entertainment", "Want"),
            "cafe mocha and sandwich": ("Food & Dining", "Want"),
            "school fees": ("Education", "Need"),
            "school van fees": ("Education", "Need"),
            "college fees": ("Education", "Need"),
            "irctc train ticket booking": ("Transport & Travel", "Want"),
            "local bus pass": ("Transport & Travel", "Need"),
            "tata play dth": ("Utilities & Bills", "Need"),
            "bus ticket to pune": None,
        }
        for text, want in cases.items():
            res = match_merchant_rule(text)
            self.assertEqual(res and (res["category"], res["type"]), want, text)


class TestPipelinePairs(unittest.TestCase):
    def test_category_type_pairs_valid_when_v4_loaded(self):
        clf = HybridClassifier(BASE_DIR)
        if not clf.load_v4():
            self.skipTest("models/finaura-v4 not trained")
        for text in ["vada pav", "POS 4521 RELIANCE SMART", "cigarettes", "gym membership", "paid ravi 500",
                     "UPI/DR/412345678901/RAMESH KIRANA/okaxis", "school van fees", "monthly sip"]:
            res = clf.classify(text)
            self.assertIn(res["type"], ALLOWED_TYPES[res["category"]], f"{text}: {res['category']}|{res['type']}")
            if res["classificationSource"] == "finaura_v4":
                self.assertEqual(len(res["all_probs"]), 14)


if __name__ == "__main__":
    unittest.main()
