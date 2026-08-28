"""
classifier/category_map.py
--------------------------
Maps the mitulshah/transaction-categorization dataset categories
to FINAURA's 10-category Indian-context taxonomy.

Handles ambiguity explicitly: transactions that cannot be reliably
categorised from text alone are routed to FINAURA's "Misc" category
with a `flagged_for_review` marker and low confidence.

FINAURA categories: Food, Travel, Entertainment, Shopping, Bills,
                    Groceries, Health, Party, Education, Misc
"""

# ─── Direct category mapping ──────────────────────────────────
# source category → FINAURA category (or None = discard/ambiguous)
# Covers both mitulshah and DoDataThings datasets.
SOURCE_TO_FINAURA: dict[str, str | None] = {
    # --- mitulshah categories ---
    "Food & Dining":              "Food",
    "Transportation":             "Travel",
    "Shopping & Retail":          "Shopping",
    "Entertainment & Recreation": "Entertainment",
    "Healthcare & Medical":       "Health",
    "Utilities & Services":       "Bills",
    "Financial Services":         None,   # bank fees, transfers — no expense category
    "Income":                     None,   # not an expense at all
    "Government & Legal":         None,   # taxes, fines — not reliably categorisable
    "Charity & Donations":        "Misc",
    # --- DoDataThings categories ---
    "Restaurants":                "Food",
    "Groceries":                  "Groceries",
    "Shopping":                   "Shopping",
    "Entertainment":              "Entertainment",
    "Healthcare":                 "Health",
    "Utilities":                  "Bills",
    "Subscription":               "Bills",     # Netflix, Spotify → recurring bills
    "Insurance":                  "Bills",     # recurring financial obligation
    "Housing":                    "Bills",     # rent, mortgage → bills/obligations
    "Education":                  "Education",
    "Travel":                     "Travel",
    "Personal Care":              "Shopping",  # salon, spa → shopping/personal
    "Fees":                       None,        # bank fees, service charges — ambiguous
    "Transfer":                   None,        # transfers are not categorisable expenses
    # --- Fallback (same name) ---
    "Food":                       "Food",
    "Health":                     "Health",
    "Bills":                      "Bills",
    "Misc":                       "Misc",
    "Party":                      "Party",
    "Investments":                "Investments",
}

# Keep backward compat alias
MITULSHAH_TO_FINAURA = SOURCE_TO_FINAURA


# ─── Sub-category keyword carving ─────────────────────────────
# Some FINAURA categories (Groceries, Party, Education) don't exist
# in mitulshah. We carve them out from parent categories using
# keyword matching on the transaction description.

# If a description from "Food & Dining" matches any of these keywords,
# re-map to "Groceries" instead:
GROCERY_KEYWORDS = frozenset([
    "grocery", "groceries", "supermarket", "costco", "walmart",
    "kroger", "whole foods", "trader joe", "safeway", "aldi",
    "target", "loblaws", "sobeys", "no frills", "save-on",
    "metro", "iga", "freshco", "food basics", "real canadian",
    # Indian grocers (for augmented data)
    "dmart", "d-mart", "d mart", "bigbasket", "big basket",
    "blinkit", "zepto", "instamart", "grofers", "jiomart",
    "reliance fresh", "more supermarket", "big bazaar",
    "nature's basket", "spencer's", "star bazaar",
])

# If a description from "Entertainment & Recreation" matches these,
# re-map to "Party":
PARTY_KEYWORDS = frozenset([
    "party", "bar ", "pub ", "club ", "nightclub", "lounge",
    "cocktail", "happy hour", "bachelor", "bachelorette",
    "celebration", "reception", "wedding", "farewell",
    "housewarming", "get together", "hookah",
])

# If a description from "Utilities & Services" or "Shopping & Retail"
# matches these, re-map to "Education":
EDUCATION_KEYWORDS = frozenset([
    "tuition", "university", "college", "school", "course",
    "coursera", "udemy", "edx", "skillshare", "masterclass",
    "textbook", "education", "student", "learning", "seminar",
    "workshop", "certification", "exam", "coaching", "byju",
    "unacademy", "upgrad", "vedantu",
])

# ─── Ambiguous transaction patterns ──────────────────────────
# These patterns indicate that the transaction text alone is
# insufficient to determine expense category with confidence.
AMBIGUOUS_KEYWORDS = frozenset([
    "transfer", "payment", "deposit", "withdrawal", "etransfer",
    "e-transfer", "wire", "debit", "credit", "refund",
    "reversal", "adjustment", "fee", "charge", "interest",
    "phonepe", "google pay", "gpay", "paytm", "upi",
    "cred", "neft", "imps", "rtgs", "bhim",
])


def map_category(mitulshah_category: str, description: str) -> tuple[str, bool]:
    """
    Map a mitulshah category + description to a FINAURA category.
    
    Returns:
        (finaura_category, is_ambiguous)
        - finaura_category: one of FINAURA's 11 categories
        - is_ambiguous: True if the mapping was forced or uncertain
    """
    desc_lower = description.lower()
    
    # Check for fundamentally ambiguous transactions first
    for kw in AMBIGUOUS_KEYWORDS:
        if kw in desc_lower:
            return ("Misc", True)
    
    # Get base mapping
    finaura_cat = SOURCE_TO_FINAURA.get(mitulshah_category)
    
    # None = discard this record entirely (Income, Financial Services, Gov)
    if finaura_cat is None:
        return (None, True)  # type: ignore
    
    # Sub-category carving: check if description should be re-mapped
    if finaura_cat == "Food":
        for kw in GROCERY_KEYWORDS:
            if kw in desc_lower:
                return ("Groceries", False)
    
    if finaura_cat == "Entertainment":
        for kw in PARTY_KEYWORDS:
            if kw in desc_lower:
                return ("Party", False)
    
    if finaura_cat in ("Bills", "Shopping"):
        for kw in EDUCATION_KEYWORDS:
            if kw in desc_lower:
                return ("Education", False)
    
    return (finaura_cat, False)


# ─── FINAURA category metadata ───────────────────────────────
FINAURA_CATEGORIES = [
    "Food", "Travel", "Entertainment", "Shopping", "Bills",
    "Groceries", "Health", "Party", "Education", "Investments", "Misc",
]

# Sentiment mapping (copied from api.py for consistency)
CATEGORY_SENTIMENT: dict[str, str] = {
    "Food":          "negative",
    "Travel":        "neutral",
    "Entertainment": "negative",
    "Shopping":      "negative",
    "Bills":         "neutral",
    "Groceries":     "neutral",
    "Health":        "positive",
    "Party":         "negative",
    "Education":     "positive",
    "Investments":   "positive",
    "Misc":          "neutral",
}

# Spend type mapping (copied from api.py for consistency)
CATEGORY_TYPE: dict[str, str] = {
    "Food":          "Want",
    "Travel":        "Want",
    "Entertainment": "Want",
    "Shopping":      "Want",
    "Bills":         "Need",
    "Groceries":     "Need",
    "Health":        "Investment",
    "Party":         "Want",
    "Education":     "Investment",
    "Investments":   "Investment",
    "Misc":          "Need",
}
