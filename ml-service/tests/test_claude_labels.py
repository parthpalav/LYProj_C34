"""
test_claude_labels.py
Subagent reply parsing for classifier.claude_labels: codes, rubric-invalid types, junk lines.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from classifier.claude_labels import CODES, parse_reply
from classifier.category_map import FINAURA_CATEGORIES


class TestParseReply(unittest.TestCase):
    def test_codes_cover_taxonomy(self):
        self.assertEqual(set(CODES.values()) - {"XX"}, set(FINAURA_CATEGORIES))

    def test_parse(self):
        labels, bad = parse_reply(["12\tFD\tW\n", "13\ttt\tn", "14\tHO\tW", "15\tXX\t", "oops", "16\tZZ\tN", "\n"])
        self.assertEqual(labels[12], {"category": "Food & Dining", "type": "Want"})
        self.assertEqual(labels[13], {"category": "Transport & Travel", "type": "Need"})
        self.assertEqual(labels[14], {"category": "Housing", "type": "Need"})  # Want is invalid for Housing
        self.assertEqual(labels[15]["category"], "XX")
        self.assertEqual(bad, 2)


if __name__ == "__main__":
    unittest.main()
