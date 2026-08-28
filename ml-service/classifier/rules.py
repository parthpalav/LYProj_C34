"""
rules.py
Deterministic Merchant & Rule Layer for FINAURA Hybrid Classifier.

Evaluates transaction text for known merchants, utility keywords, and unambiguous
financial patterns BEFORE passing unresolved queries to statistical/ML models.

Principles:
- Precision over recall: Rules only match unambiguous financial intents.
- Standardized return format matching the Unified Classification Contract.
- Suggestions only: Frontend/User overrides remain authoritative.
"""

import re
from typing import Optional, Dict, Any, List, Tuple

# Pre-compiled regex rule definitions:
# List of (pattern, category, spend_type, confidence)
# Higher priority / more specific rules are placed first.

_RULE_DEFINITIONS: List[Tuple[str, str, str, float]] = [
    # ── 1. Groceries & Essentials (Need) ──────────────────────────────────────
    (r"\b(amazon\s*fresh|amazon\s*pantry|blinkit|zepto|instamart|bigbasket|dmart|d\s*mart|milkbasket|country\s*delight|natures?\s*basket|spencers?|jiomart|supermarket|grocer(y|ies)|vegetables?|fruits?\s*market|milk\s*(delivery|booth|dairy)|daily\s*ration)\b", "Groceries", "Need", 0.96),

    # ── 2. Transport & Commute ────────────────────────────────────────────────
    # Public transit / essential commute (Need)
    (r"\b(mumbai\s*metro|delhi\s*metro|bangalore\s*metro|namma\s*metro|metro\s*(card|recharge|pass|station|travel)|local\s*train|irctc|train\s*(ticket|ticket\s*booking|pass|commute)|bus\s*(pass|ticket|fare|travel)|railway\s*(pass|ticket)|public\s*transport|auto\s*fare)\b", "Travel", "Need", 0.96),
    # Cabs / rideshare / flights / vacations (Want)
    (r"\b(uber|ola(\s*cabs?|\s*ride)?|rapido|blusmart|taxi(\s*fare|\s*ride|\s*home)?|cab(\s*booking|\s*ride)?|indigo\s*airlines?|air\s*india|spicejet|vistara|flight(\s*ticket|\s*booking)?|makemytrip|cleartrip|goibibo|hotel\s*booking|airbnb)\b", "Travel", "Want", 0.95),

    # ── 3. Food & Dining Out (Want) ───────────────────────────────────────────
    (r"\b(zomato|swiggy|mcdonalds?|dominos?|pizza\s*hut|starbucks|kfc|burger\s*king|subway|haldirams?|behrouz\s*biryani|faasos|ovenstory|barbeque\s*nation|chaayos|chai\s*point|pizza|burgers?|restaurant|cafe|dining\s*out|lunch\s*(order|with\s*team)|dinner\s*(order|with\s*friends)|swiggy\s*dinner|zomato\s*lunch)\b", "Food", "Want", 0.95),

    # ── 4. Bills & Essential Utilities (Need) ─────────────────────────────────
    (r"\b(electricity(\s*bill|\s*payment)?|bescom|tneb|mahadiscom|tata\s*power|adani\s*electricity|torrent\s*power|water\s*bill|piped\s*gas|indane|hp\s*gas|bharat\s*gas|mahanagar\s*gas|igl\s*gas|broadband(\s*bill)?|wifi\s*bill|airtel\s*(broadband|fiber|recharge)|jio\s*(fiber|recharge)|act\s*fibernet|mobile\s*recharge|dth\s*recharge|house\s*rent|rent\s*payment|maintenance\s*bill|loan\s*emi|home\s*loan|car\s*loan\s*emi)\b", "Bills", "Need", 0.96),

    # ── 5. Healthcare & Pharmacy (Need) ───────────────────────────────────────
    (r"\b(apollo\s*pharmacy|pharmacy|medplus|tata\s*1mg|1mg|netmeds|pharmeasy|hospital|clinic|doctor\s*(fee|consultation|visit)|diagnostic\s*lab|pathology|dr\s*lal\s*pathlabs|metropolis\s*healthcare|thyrocare|dental\s*clinic|medicines?|tablets?|blood\s*test|health\s*checkup)\b", "Health", "Need", 0.96),

    # ── 6. Investments & Wealth Building (Investment) ─────────────────────────
    # A. Dedicated Brokers & Investment Platforms
    (r"\b(zerodha(\s*kite)?|groww|upstox|angel\s*one|angelone|kuvera|etmoney|smallcase|indmoney|dhan|geojit|motilal\s*oswal|sharekhan|icici\s*direct|hdfc\s*sec(urities)?|kotak\s*securities|demat(\s*account)?)\b", "Investments", "Investment", 0.98),

    # B. Stock Indices & Core Investment Vehicles
    (r"\b(nifty\s*50|nifty50|nifty(\s*etf|\s*index|\s*bees|\s*next\s*50)?|sensex|s&p\s*500|nasdaq(\s*100)?|mutual\s*funds?(\s*sip|\s*investment|\s*units?|\s*scheme|\s*plan|\s*portfolio)?|(monthly\s*)?sip(\s*investment|\s*payment|\s*deduction|\s*instalment|\s*installment|\s*order)?|etf(\s*investment|\s*purchase|\s*units?|\s*portfolio)?|index\s*funds?(\s*sip|\s*investment|\s*units?)?|equity\s*(shares?|investment|purchase|portfolio|fund))\b", "Investments", "Investment", 0.98),

    # C. Stock / Equity Purchases (avoiding false positives like 'share cab' or 'stock up')
    (r"\b((bought|buy|purchased?|invest(ed|ing)?\s*in)\s+(.*?)(shares?|stocks?|equity)|(nvidia|nvda|apple|aapl|reliance|tcs|infosys|infy|hdfc|icici|sbi|tata\s*motors|tesla|tsla|google|googl|microsoft|msft|meta|amazon)\s+(shares?|stocks?|equity)|(shares?|stocks?)\s*(purchase|investment|bought|buy|portfolio))\b", "Investments", "Investment", 0.97),

    # D. Government / Retirement / Fixed Income / Securities
    (r"\b(ppf(\s*deposit|\s*contribution|\s*transfer|\s*account)?|nps(\s*contribution|\s*tier\s*[12]|\s*deposit)?|epf(\s*contribution|\s*transfer)?|provident\s*fund|sovereign\s*gold\s*bond(s)?|sgb|treasury\s*bills?|t\s*bills?|((government|govt|corporate|rbi|treasury|tax\s*saving)\s*bonds?|bonds?\s*(investment|purchase|yield|portfolio))|securities\s*(investment|purchase|holding|trading))\b", "Investments", "Investment", 0.98),

    # ── 7. Education & Skill Building (Investment) ────────────────────
    (r"\b(coursera|udemy|edx|skillshare|unacademy|byjus?|physics\s*wallah|tuition\s*fees?|coaching\s*fees?|college\s*fees?|school\s*fees?|university\s*fees?|exam\s*fees?|gate\s*exam|cat\s*exam|textbooks?|educational\s*books?)\b", "Education", "Investment", 0.95),

    # ── 8. Entertainment & Leisure (Want) ─────────────────────────────────────
    (r"\b(netflix|spotify|hotstar|disney\+?(\s*hotstar)?|prime\s*video|apple\s*music|youtube\s*premium|sony\s*liv|zee5|pvr(\s*cinemas)?|inox|cinepolis|bookmyshow|playstation|steam\s*games?|xbox|movie\s*tickets?|gaming)\b", "Entertainment", "Want", 0.96),

    # ── 9. Party & Nightlife (Want) ───────────────────────────────────────────
    (r"\b(nightclub|pub|brewery|cocktail\s*bar|liquor\s*store|wine\s*shop|beer\s*cafe|party\s*drinks?|clubbing)\b", "Party", "Want", 0.95),

    # ── 10. Shopping & Discretionary Goods (Want) ─────────────────────────────
    (r"\b(myntra|ajio|nykaa|zara|h&m|uniqlo|flipkart|meesho|tata\s*cliq|decathlon|croma|reliance\s*digital|ikea|luxury\s*watch|jewellery|tanishq|kalyan\s*jewellers|caratlane|apple\s*store|amazon\s*(impulse|purchase|order|shopping)?|shopping)\b", "Shopping", "Want", 0.92),
]

_COMPILED_RULES = [
    (re.compile(pattern, re.IGNORECASE), cat, spend_type, conf)
    for pattern, cat, spend_type, conf in _RULE_DEFINITIONS
]


def clean_rule_text(text: str) -> str:
    """Normalize text before matching against rule patterns."""
    text = text.lower()
    # Strip apostrophes (e.g. McDonald's -> mcdonalds, Nature's -> natures)
    text = re.sub(r"['’`]", "", text)
    # Strip currency annotations (e.g. ₹500, 500rs, 500 inr)
    text = re.sub(r"(₹|rs\.?|inr)\s*\d+(\.\d+)?|\d+(\.\d+)?\s*(₹|rs\.?|inr)", " ", text)
    # Strip standalone digits
    text = re.sub(r"\b\d+\b", " ", text)
    # Normalize punctuation to spaces
    text = re.sub(r"[^a-z0-9\s\+\&]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def match_merchant_rule(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Match raw transaction description against deterministic merchant/keyword rules.
    
    Returns structured dict if a high-confidence rule fires, or None if unresolved.
    """
    if not raw_text or not raw_text.strip():
        return None

    cleaned = clean_rule_text(raw_text)
    if not cleaned:
        return None

    for pattern, category, spend_type, confidence in _COMPILED_RULES:
        if pattern.search(cleaned):
            return {
                "category": category,
                "type": spend_type,
                "confidence": confidence,
                "confidenceScore": confidence,
                "classificationSource": "merchant_rule",
                "needsReview": False,
                "flagged_for_review": False,
            }

    return None
