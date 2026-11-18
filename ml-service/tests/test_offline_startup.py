"""
ml-service/tests/test_offline_startup.py

The fine-tuned weights are missing and the Google Drive download fails (offline).
Startup must not exit: it falls back to the packaged legacy classifier, /health
says which backend is active, and classify, sentiment and simulate all answer.

Run: python3 ml-service/tests/test_offline_startup.py
"""
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ML_DIR)
os.environ.setdefault("HF_HUB_OFFLINE", "1")  # no network for the MiniLM type head either

import api  # noqa: E402
from classifier.hybrid_pipeline import HybridClassifier  # noqa: E402

LEGACY_FILES = [f for f in os.listdir(ML_DIR) if f.endswith(".pkl")]


class OfflineStartup(unittest.TestCase):
    def setUp(self):
        # A service directory with the packaged legacy models but no models/ (no v7 weights).
        self.tmp = tempfile.mkdtemp()
        for f in LEGACY_FILES:
            os.symlink(os.path.join(ML_DIR, f), os.path.join(self.tmp, f))
        self.clf = HybridClassifier(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_download_failure_falls_back_and_serves(self):
        with mock.patch("gdown.download_folder", side_effect=ConnectionError("network unreachable")), \
                mock.patch.object(api, "_hybrid_classifier", self.clf):
            backend = api.prepare_classifier()
            self.assertIn(backend["backend"], ("tfidf_v2", "tfidf"), backend)

            client = api.app.test_client()
            health = client.get("/health").get_json()
            self.assertEqual(health["classifier"]["backend"], backend["backend"])

            r = client.post("/classify", json={"text": "monthly electricity bill payment"})
            self.assertEqual(r.status_code, 200)
            body = r.get_json()
            self.assertIn(body["classificationSource"], ("merchant_rule", "tfidf_v2", "tfidf"))
            self.assertTrue(body["category"])

            r = client.post("/classify", json={"text": "qwzx blorp 77"})
            self.assertEqual(r.status_code, 200)
            self.assertIn(r.get_json()["classificationSource"], ("tfidf_v2", "tfidf"))

            self.assertEqual(client.post("/sentiment", json={"text": "late night snacks"}).status_code, 200)

            sim = client.post("/simulate", json={
                "startingCorpus": 1_000_000, "monthlyContribution": 25_000, "expectedReturnRate": 0.08,
                "expectedInflationRate": 0.06, "portfolioVolatility": 0.15, "estimatedFireCorpus": 12_000_000,
                "monthsUntilRetirement": 300, "contributionMode": "NOMINAL_FLAT", "simulationCount": 200, "seed": 7,
            })
            self.assertEqual(sim.status_code, 200)

    def test_missing_gdown_also_falls_back(self):
        with mock.patch.dict(sys.modules, {"gdown": None}), mock.patch.object(api, "_hybrid_classifier", self.clf):
            self.assertIn(api.prepare_classifier()["backend"], ("tfidf_v2", "tfidf"))


if __name__ == "__main__":
    result = unittest.main(exit=False, verbosity=2).result
    sys.exit(0 if result.wasSuccessful() else 1)
