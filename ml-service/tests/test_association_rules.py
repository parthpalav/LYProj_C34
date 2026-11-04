"""
ml-service/tests/test_association_rules.py
Apriori + association rules: textbook example (Tan, Steinbach & Kumar, ch. 6) and
/association-rules input validation.
"""

import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from association_rules import apriori, generate_rules
from api import app

BASKETS = [
    ['bread', 'milk'],
    ['bread', 'diaper', 'beer', 'eggs'],
    ['milk', 'diaper', 'beer', 'cola'],
    ['bread', 'milk', 'diaper', 'beer'],
    ['bread', 'milk', 'diaper', 'cola'],
]


class TestApriori(unittest.TestCase):
    def test_frequent_itemsets(self):
        sets = apriori(BASKETS, min_support=0.4)
        self.assertEqual(len(sets), 17)  # 5 singles, 8 pairs, 4 triples
        self.assertAlmostEqual(sets[frozenset(['bread'])], 0.8)
        self.assertAlmostEqual(sets[frozenset(['diaper', 'beer'])], 0.6)
        self.assertAlmostEqual(sets[frozenset(['milk', 'diaper', 'beer'])], 0.4)
        self.assertNotIn(frozenset(['eggs']), sets)            # support 0.2
        self.assertNotIn(frozenset(['bread', 'milk', 'beer']), sets)  # support 0.2

    def test_max_len(self):
        sets = apriori(BASKETS, min_support=0.4, max_len=2)
        self.assertTrue(all(len(s) <= 2 for s in sets))

    def test_rule_metrics(self):
        rules = generate_rules(apriori(BASKETS, min_support=0.4), min_confidence=0.6)
        by = {(tuple(r['antecedent']), r['consequent']): r for r in rules}
        r = by[(('diaper', 'milk'), 'beer')]
        self.assertAlmostEqual(r['support'], 0.4)
        self.assertAlmostEqual(r['confidence'], 0.6667, places=4)
        self.assertAlmostEqual(r['lift'], 1.1111, places=4)
        r = by[(('diaper',), 'beer')]
        self.assertAlmostEqual(r['confidence'], 0.75)
        self.assertAlmostEqual(r['lift'], 1.25)
        self.assertTrue(all(r['confidence'] >= 0.6 for r in rules))

    def test_support_equal_to_threshold_is_frequent(self):
        # 0.07 * 100 == 7.000000000000001 in floating point
        for n, ms in [(100, 0.07), (50, 0.14), (100, 0.29)]:
            k = round(ms * n)
            sets = apriori([['a']] * k + [['b']] * (n - k), min_support=ms, max_len=1)
            self.assertIn(frozenset(['a']), sets, (n, ms))

    def test_empty(self):
        self.assertEqual(apriori([], 0.5), {})
        self.assertEqual(generate_rules({}), [])


class TestAssociationRulesApi(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    def post(self, body):
        return self.app.post('/association-rules', data=json.dumps(body), content_type='application/json')

    def test_ok(self):
        res = self.post({'baskets': BASKETS, 'min_support': 0.4, 'min_confidence': 0.6})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['basket_count'], 5)
        self.assertEqual(data['itemset_count'], 17)
        self.assertTrue(data['rules'])
        top = data['rules'][0]
        self.assertEqual(set(top), {'antecedent', 'consequent', 'support', 'confidence', 'lift'})

    def test_returns_only_positive_lift_rules_without_top_50_cut(self):
        # 12 independent-ish items over 60 baskets: well over 50 rules before the lift filter
        baskets = [[f'i{j}' for j in range(12) if (b * (j + 3)) % 7 < 4] for b in range(60)]
        mined = generate_rules(apriori(baskets, 0.05, 3), 0.0)
        res = self.post({'baskets': baskets, 'min_support': 0.05, 'min_confidence': 0.0})
        rules = res.get_json()['rules']
        self.assertTrue(all(r['lift'] > 1 for r in rules))
        self.assertEqual(len(rules), sum(1 for r in mined if r['lift'] > 1))
        self.assertGreater(len(rules), 50)

    def test_rejects_bad_input(self):
        for body in [
            {},
            {'baskets': []},
            {'baskets': 'bread'},
            {'baskets': [['bread', 3]]},
            {'baskets': [['x' * 81]]},
            {'baskets': [['a']] * 5001},
            {'baskets': [['a'] * 51]},
            {'baskets': BASKETS, 'min_support': 0},
            {'baskets': BASKETS, 'min_support': 'high'},
            {'baskets': BASKETS, 'min_confidence': 1.5},
            {'baskets': BASKETS, 'max_len': 9},
            {'baskets': BASKETS, 'max_len': True},
        ]:
            self.assertEqual(self.post(body).status_code, 400, body if len(str(body)) < 200 else 'large body')


if __name__ == '__main__':
    unittest.main(verbosity=1)
