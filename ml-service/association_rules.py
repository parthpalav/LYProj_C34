"""
ml-service/association_rules.py
Association rule mining with the Apriori algorithm (Agrawal & Srikant, 1994).

Pure Python, no extra dependency. A basket is the set of items bought together
(the server sends one basket per user-day; items are categories and frequent merchants).

  apriori(baskets, min_support, max_len)   -> {frozenset(itemset): support}
  generate_rules(itemsets, min_confidence) -> [{antecedent, consequent, support, confidence, lift}]

Rules have a single-item consequent ("if you bought A and B, you will likely buy C"),
which is what purchase prediction needs.
"""

from collections import Counter
from itertools import combinations


def apriori(baskets, min_support=0.05, max_len=3):
    """Level-wise frequent itemset search.

    Level k candidates are unions of two frequent (k-1)-itemsets, kept only when every
    (k-1)-subset is frequent (the Apriori property: a superset of an infrequent set
    is infrequent). Support = share of baskets containing the itemset.
    """
    sets = [frozenset(b) for b in baskets if b]
    n = len(sets)
    if n == 0:
        return {}
    # Epsilon: 0.07 * 100 is 7.000000000000001 in floating point, which would drop a support of exactly 0.07
    min_count = min_support * n - 1e-9

    item_counts = Counter(item for b in sets for item in b)
    current = {frozenset([i]): c for i, c in item_counts.items() if c >= min_count}
    frequent = dict(current)

    k = 2
    while current and k <= max_len:
        prev = list(current)
        candidates = set()
        for i in range(len(prev)):
            for j in range(i + 1, len(prev)):
                union = prev[i] | prev[j]
                if len(union) == k and all(union - {x} in current for x in union):
                    candidates.add(union)
        counts = {c: sum(1 for b in sets if c <= b) for c in candidates}
        current = {c: cnt for c, cnt in counts.items() if cnt >= min_count}
        frequent.update(current)
        k += 1

    return {itemset: count / n for itemset, count in frequent.items()}


def generate_rules(itemsets, min_confidence=0.4):
    """Rules X -> {y} from every frequent itemset of size >= 2.

    confidence = support(X ∪ {y}) / support(X)
    lift       = confidence / support({y})   (> 1 means y is more likely after X)
    """
    rules = []
    for itemset, support in itemsets.items():
        if len(itemset) < 2:
            continue
        for consequent in itemset:
            antecedent = itemset - {consequent}
            confidence = support / itemsets[antecedent]
            if confidence < min_confidence:
                continue
            lift = confidence / itemsets[frozenset([consequent])]
            rules.append({
                'antecedent': sorted(antecedent),
                'consequent': consequent,
                'support': round(support, 4),
                'confidence': round(confidence, 4),
                'lift': round(lift, 4),
            })
    rules.sort(key=lambda r: (-(r['confidence'] * r['lift']), -r['support'], r['consequent']))
    return rules
