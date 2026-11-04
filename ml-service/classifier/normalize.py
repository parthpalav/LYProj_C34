"""
normalize.py
Turns raw transaction text (typed descriptions, UPI / POS / NEFT bank strings)
into clean text for the rules and the v4 model. The server's per-user merchant
memory (server/services/MerchantMemoryService.js) mirrors this logic in JS.

    clean_text("UPI/DR/412345678/RAMESH KIRANA/okaxis") -> "ramesh kirana"
    clean_text("Zomato dinner order ₹450")              -> "zomato dinner order"
"""

import re

# Bank-statement strings start with a rail prefix or carry long reference numbers / VPAs.
_BANK_STRING = re.compile(r"^\s*(upi|neft|imps|rtgs|pos|ach|nach|bil|ecom|mmt|int)\b|\b(txn|pos)\b|\d{6,}|@[a-z]", re.IGNORECASE)

# Structural tokens that only appear in bank strings (never stripped from typed text,
# so "Dr Lal Pathlabs" or "pos" in a sentence survive).
_RAIL_TOKENS = {
    "upi", "dr", "cr", "neft", "imps", "rtgs", "pos", "ach", "nach", "bil", "onl", "ecom",
    "txn", "trf", "ref", "mmt", "int", "inb", "mb", "ib", "vps", "vsi", "pur", "purchase",
    "debit", "credit", "card", "p2a", "p2m", "collect", "pay", "sent", "received", "upiintent",
    "nwd", "atw", "wdl", "pcd", "yesb", "ybs", "netbank", "autopay",
}
# VPA handle suffixes / bank short codes seen in UPI strings.
_HANDLE_TOKENS = {
    "okaxis", "oksbi", "okicici", "okhdfcbank", "ybl", "ibl", "axl", "apl", "paytm", "upi",
    "hdfcbank", "icici", "sbi", "axis", "kotak", "yesbank", "idfcbank", "barodampay", "fbl",
    "axisbank", "icicibank", "sbin", "utib", "hdfc", "kkbk", "punb", "jupiteraxis", "freecharge",
}
_IFSC = re.compile(r"\b[a-z]{4}0[a-z0-9]{6}\b")


def _is_ref(token: str) -> bool:
    """Reference numbers, card masks and terminal ids; short brand tokens like 1mg, box8, 5paisa survive."""
    digits = sum(c.isdigit() for c in token)
    return digits > 0 and (len(token) > 6 or digits > 2 or digits == len(token))


def _strip_amounts(text: str) -> str:
    text = re.sub(r"(₹|rs\.?|inr)\s*\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s*(₹|rs\.?|inr|/-)", " ", text)
    return re.sub(r"\b\d+(\.\d+)?\b", " ", text)


def clean_text(raw: str) -> str:
    """Lowercased text with amounts, refs and bank-string scaffolding removed."""
    text = (raw or "").lower()
    text = re.sub(r"['’`]", "", text)
    if _BANK_STRING.search(text):
        text = _IFSC.sub(" ", text)
        # Keep the local part of a VPA, minus digits: "zomato.order@hdfcbank" -> "zomato order", "swiggy8@ybl" -> "swiggy"
        text = re.sub(r"([a-z0-9._-]+)@[a-z]+", lambda m: re.sub(r"\d+", " ", m.group(1)), text)
        tokens = re.split(r"[\s/|\-_*:,.#]+", text)
        tokens = [
            t for t in tokens
            if t and not _is_ref(t) and t not in _RAIL_TOKENS and t not in _HANDLE_TOKENS
        ]
        text = " ".join(dict.fromkeys(tokens))  # HDFC repeats the payee as name and VPA
    text = _strip_amounts(text)
    text = re.sub(r"[^a-z0-9\s\+\&]", " ", text)
    return re.sub(r"\s+", " ", text).strip()
