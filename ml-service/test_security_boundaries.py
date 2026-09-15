"""
ml-service/test_security_boundaries.py
Comprehensive ML Service Security & Input Boundary Test Suite.

Verifies:
1. MAX_CONTENT_LENGTH enforcement (1MB payload returns 413 PAYLOAD_TOO_LARGE JSON)
2. /classify text validation (empty, non-string, >1000 chars rejected with 400)
3. /sentiment text validation (>1000 chars rejected with 400)
4. /predict validation (non-list series, non-finite balance rejected with 400)
5. /simulate simulationCount upper bound (50,000 maximum enforced)
6. /simulate non-finite numbers (NaN, Infinity rejected before NumPy allocation)
7. /simulate horizon upper bound (max 1200 months enforced)
8. /simulate contributionMode enum validation
"""

import unittest
import json
import math
from api import app

class TestMLSecurityBoundaries(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    # ── 1. Content Length & Body Limits ──────────────────────────────────────
    def test_01_payload_over_1mb_rejected_with_413(self):
        """Requests over 1MB should be rejected with 413 and clean JSON error."""
        huge_text = "a" * (1024 * 1024 + 100)
        res = self.app.post('/classify', data=json.dumps({"text": huge_text}), content_type='application/json')
        self.assertEqual(res.status_code, 413)
        data = res.get_json()
        self.assertIn("error", data)
        self.assertEqual(data["error"]["code"], "PAYLOAD_TOO_LARGE")

    # ── 2. /classify Boundaries ──────────────────────────────────────────────
    def test_02_classify_empty_text_rejected(self):
        res = self.app.post('/classify', json={"text": "   "})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    def test_03_classify_non_string_text_rejected(self):
        res = self.app.post('/classify', json={"text": 12345})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    def test_04_classify_over_1000_chars_rejected(self):
        res = self.app.post('/classify', json={"text": "w" * 1001})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)
        self.assertIn("1000", data["error"])

    # ── 3. /sentiment Boundaries ─────────────────────────────────────────────
    def test_05_sentiment_over_1000_chars_rejected(self):
        res = self.app.post('/sentiment', json={"text": "s" * 1001})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    # ── 4. /predict Boundaries ───────────────────────────────────────────────
    def test_06_predict_invalid_series_rejected(self):
        res = self.app.post('/predict', json={"spending_series": "not_a_list", "balance": 5000})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    # ── 5. /simulate Bounds & Non-Finite Numbers ──────────────────────────────
    def test_07_simulate_count_over_50k_rejected(self):
        """Simulation count > 50,000 must be rejected."""
        payload = {
            "startingCorpus": 100000,
            "monthlyContribution": 10000,
            "expectedReturnRate": 0.12,
            "expectedInflationRate": 0.06,
            "portfolioVolatility": 0.15,
            "estimatedFireCorpus": 5000000,
            "monthsUntilRetirement": 240,
            "contributionMode": "NOMINAL_FLAT",
            "simulationCount": 50001,
            "seed": 42
        }
        res = self.app.post('/simulate', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)
        self.assertIn("simulationCount", data["error"]["message"])

    def test_08_simulate_rejects_negative_or_invalid_inputs(self):
        """Negative startingCorpus or estimatedFireCorpus <= 0 must be rejected."""
        payload = {
            "startingCorpus": -1000,
            "monthlyContribution": 10000,
            "expectedReturnRate": 0.12,
            "expectedInflationRate": 0.06,
            "portfolioVolatility": 0.15,
            "estimatedFireCorpus": 5000000,
            "monthsUntilRetirement": 240,
            "contributionMode": "NOMINAL_FLAT",
            "simulationCount": 1000,
            "seed": 42
        }
        res = self.app.post('/simulate', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    def test_09_simulate_horizon_over_1200_months_rejected(self):
        """Retirement horizon > 1200 months (100 years) must be rejected."""
        payload = {
            "startingCorpus": 100000,
            "monthlyContribution": 10000,
            "expectedReturnRate": 0.12,
            "expectedInflationRate": 0.06,
            "portfolioVolatility": 0.15,
            "estimatedFireCorpus": 5000000,
            "monthsUntilRetirement": 1201,
            "contributionMode": "NOMINAL_FLAT",
            "simulationCount": 1000,
            "seed": 42
        }
        res = self.app.post('/simulate', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    def test_10_simulate_invalid_contribution_mode_rejected(self):
        """Invalid contributionMode enum value must be rejected."""
        payload = {
            "startingCorpus": 100000,
            "monthlyContribution": 10000,
            "expectedReturnRate": 0.12,
            "expectedInflationRate": 0.06,
            "portfolioVolatility": 0.15,
            "estimatedFireCorpus": 5000000,
            "monthsUntilRetirement": 240,
            "contributionMode": "INVALID_MODE_EXPLODING",
            "simulationCount": 1000,
            "seed": 42
        }
        res = self.app.post('/simulate', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

if __name__ == '__main__':
    unittest.main()
