"""
classifier/category_map.py
--------------------------
FINAURA Canonical 14-Category V3 Taxonomy & Metadata Maps.

Canonical Categories:
1. Food & Dining
2. Groceries
3. Transport & Travel
4. Housing
5. Utilities & Bills
6. Debt & Loan Payments
7. Shopping
8. Entertainment
9. Health
10. Education
11. Personal Care
12. Insurance
13. Investments
14. Misc
"""

SOURCE_TO_FINAURA: dict[str, str | None] = {
    # --- Legacy V1 / V2 categories to Canonical V3 ---
    "Food":                       "Food & Dining",
    "Food & Dining":              "Food & Dining",
    "Restaurants":                "Food & Dining",
    "Groceries":                  "Groceries",
    "Travel":                     "Transport & Travel",
    "Transport & Travel":         "Transport & Travel",
    "Transportation":             "Transport & Travel",
    "Housing":                    "Housing",
    "Bills":                      "Utilities & Bills",
    "Utilities & Bills":          "Utilities & Bills",
    "Utilities":                  "Utilities & Bills",
    "Utilities & Services":       "Utilities & Bills",
    "Debt & Loan Payments":       "Debt & Loan Payments",
    "Shopping":                   "Shopping",
    "Shopping & Retail":          "Shopping",
    "Entertainment":              "Entertainment",
    "Entertainment & Recreation": "Entertainment",
    "Party":                      "Entertainment",
    "Health":                     "Health",
    "Healthcare":                 "Health",
    "Healthcare & Medical":       "Health",
    "Education":                  "Education",
    "Personal Care":              "Personal Care",
    "Insurance":                  "Insurance",
    "Investments":                "Investments",
    "Misc":                       "Misc",
    "Subscription":               "Utilities & Bills",
    "Fees":                       None,
    "Transfer":                   None,
    "Income":                     None,
}

MITULSHAH_TO_FINAURA = SOURCE_TO_FINAURA

FINAURA_CATEGORIES = [
    "Food & Dining",
    "Groceries",
    "Transport & Travel",
    "Housing",
    "Utilities & Bills",
    "Debt & Loan Payments",
    "Shopping",
    "Entertainment",
    "Health",
    "Education",
    "Personal Care",
    "Insurance",
    "Investments",
    "Misc",
]

CATEGORY_SENTIMENT: dict[str, str] = {
    "Food & Dining":         "negative",
    "Groceries":             "neutral",
    "Transport & Travel":    "neutral",
    "Housing":               "neutral",
    "Utilities & Bills":     "neutral",
    "Debt & Loan Payments":  "neutral",
    "Shopping":              "negative",
    "Entertainment":         "negative",
    "Health":                "positive",
    "Education":             "positive",
    "Personal Care":         "neutral",
    "Insurance":             "positive",
    "Investments":           "positive",
    "Misc":                  "neutral",
}

CATEGORY_TYPE: dict[str, str] = {
    "Food & Dining":         "Want",
    "Groceries":             "Need",
    "Transport & Travel":    "Want",
    "Housing":               "Need",
    "Utilities & Bills":     "Need",
    "Debt & Loan Payments":  "Need",
    "Shopping":              "Want",
    "Entertainment":         "Want",
    "Health":                "Need",
    "Education":             "Investment",
    "Personal Care":         "Want",
    "Insurance":             "Need",
    "Investments":           "Investment",
    "Misc":                  "Need",
}
