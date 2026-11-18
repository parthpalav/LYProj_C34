"""
ml-service/tests/test_classify_batch.py
/classify-batch returns one /classify-shaped result per text, in order, and validates input.
"""

import os
import sys
import unittest
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app


class TestClassifyBatch(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    def post(self, body):
        return self.app.post('/classify-batch', data=json.dumps(body), content_type='application/json')

    def test_results_match_single_classify_in_order(self):
        texts = ['UPI/SWIGGY/9876543210/food order', 'netflix subscription', 'NEFT rent to landlord']
        res = self.post({'texts': texts})
        self.assertEqual(res.status_code, 200)
        results = res.get_json()['results']
        self.assertEqual(len(results), 3)
        for text, got in zip(texts, results):
            single = self.app.post('/classify', data=json.dumps({'text': text}), content_type='application/json').get_json()
            self.assertEqual(got['category'], single['category'])
            self.assertEqual(got['type'], single['type'])

    def test_rejects_bad_input(self):
        self.assertEqual(self.post({}).status_code, 400)
        self.assertEqual(self.post({'texts': []}).status_code, 400)
        self.assertEqual(self.post({'texts': ['ok', '']}).status_code, 400)
        self.assertEqual(self.post({'texts': ['ok', 5]}).status_code, 400)
        self.assertEqual(self.post({'texts': ['x' * 1001]}).status_code, 400)
        self.assertEqual(self.post({'texts': ['a'] * 501}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
