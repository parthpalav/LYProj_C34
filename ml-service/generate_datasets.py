"""
generate_datasets.py
--------------------
Generates 4 synthetic training datasets for the Finaura ML pipeline.
Outputs to ml-service/data/ (alongside existing data files).

IMPORTANT: This does NOT modify any existing files (dataset.csv,
classifier_model.pkl, tfidf_vectorizer.pkl, fmi_engine.py, api.py).
The generated CSVs are for future model training only.

Run:
    python generate_datasets.py
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

random.seed(42)
np.random.seed(42)

# Output to ml-service/data/ (same directory as existing data)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE_DIR, "data")
os.makedirs(OUT, exist_ok=True)

# -----------------------------
# 1. KEYWORD LOGIC DATASET
# -----------------------------

need_base = [
    "rent","medicine","hospital","doctor","grocery","groceries","milk","rice","dal","vegetables",
    "school","fees","college","tuition","electricity","water","gas","internet","bus","train",
    "fuel","loan emi","insurance","family support","repair","medical","pharmacy","uniform","books","stationery"
]

want_base = [
    "pizza","burger","party","club","movie","netflix","shopping","zomato","swiggy","dinner",
    "friends","late night","snacks","gaming","clothes","shoes","coffee","dessert","trip","vacation",
    "concert","date","mall","impulse buy","online shopping","cosmetics","salon","gift","treat","outing"
]

investment_base = [
    "sip","mutual fund","stocks","gold","silver","fd","fixed deposit","rd","recurring deposit","nps",
    "ppf","saving","savings","emergency fund","index fund","bond","etf","crypto","retirement","pension",
    "wealth","portfolio","investment","capital","asset","deposit","long term","financial goal","dividend","interest"
]

modifiers = [
    "monthly","weekly","urgent","planned","regular","online","offline","small","large","family",
    "personal","work","home","night","morning","discounted","cashback","essential","extra","emergency",
    "festival","medical","college","office","client","local","first time","repeat","subscription","advance",
    "basic","premium","low cost","high value","recurring","one time","safe","risky","stable","delayed"
]

def expand_keywords(base, label, n=1000):
    rows = []
    while len(rows) < n:
        b = random.choice(base)
        m = random.choice(modifiers)
        phrase = f"{m} {b}"
        rows.append({
            "keyword": phrase,
            "base_keyword": b,
            "label": label,
            "weight": round(random.uniform(0.55, 0.95), 2),
            "logic": f"Detected as {label} due to keyword/context: {phrase}"
        })
    return rows

keyword_rows = []
keyword_rows += expand_keywords(need_base, "need", 1000)
keyword_rows += expand_keywords(want_base, "want", 1000)
keyword_rows += expand_keywords(investment_base, "investment", 1000)

pd.DataFrame(keyword_rows).drop_duplicates("keyword").to_csv(os.path.join(OUT, "keyword_logic.csv"), index=False)
print(f"  ✅ keyword_logic.csv → {len(keyword_rows)} rows")


# -----------------------------
# 2. EXPENSE CATEGORY DATASET
# -----------------------------

items = {
    "Food & Dining": {
        "need": ["rice","dal","milk","bread","vegetables","fruits","eggs","chicken","fish","atta","oil","salt","breakfast"],
        "want": ["pizza","burger","fries","coke","ice cream","cake","shawarma","biryani party","late night food","fancy dinner"]
    },
    "Education": {
        "need": ["book","pen","pencil","notebook","school fees","college fees","exam form","course subscription"],
        "investment": ["certification course","skill course","coding bootcamp","professional workshop"]
    },
    "Health": {
        "need": ["medicine","doctor visit","hospital bill","blood test","therapy","pharmacy","surgery","health insurance"]
    },
    "Entertainment": {
        "want": ["movie ticket","netflix","spotify","gaming","concert","club entry","bowling","arcade","party"]
    },
    "Shopping": {
        "want": ["shirt","jeans","shoes","watch","perfume","makeup","online shopping","impulse purchase"]
    },
    "Transport": {
        "need": ["bus pass","train ticket","fuel","metro card","office cab","auto to work"],
        "want": ["weekend cab","late night cab","road trip fuel"]
    },
    "Investment": {
        "investment": ["SIP","mutual fund","gold","silver","stocks","FD","RD","NPS","PPF","ETF","emergency fund"]
    },
    "Bills & Obligations": {
        "need": ["rent","electricity bill","water bill","gas bill","wifi bill","phone bill","EMI","loan repayment"]
    },
    "Work": {
        "need": ["office tools","client meeting","laptop repair","software subscription"],
        "investment": ["business course","work equipment upgrade","professional license"]
    }
}

expense_rows = []
for category, labels in items.items():
    for label, names in labels.items():
        for item in names:
            expense_rows.append({
                "item": item,
                "category": category,
                "default_label": label,
                "subcategory": item,
                "notes": f"{item} is usually classified as {label}, but final label may change using amount/time/baseline context."
            })

for _ in range(1000):
    category = random.choice(list(items.keys()))
    label = random.choice(["need", "want", "investment"])
    item = random.choice(need_base + want_base + investment_base)
    expense_rows.append({
        "item": f"{random.choice(modifiers)} {item}",
        "category": category,
        "default_label": label,
        "subcategory": item,
        "notes": "Synthetic category mapping for training/testing."
    })

pd.DataFrame(expense_rows).drop_duplicates("item").to_csv(os.path.join(OUT, "expense_categories.csv"), index=False)
print(f"  ✅ expense_categories.csv → {len(expense_rows)} rows")


# -----------------------------
# 3. RAW USER HISTORIES
# -----------------------------

profiles = (
    ["stable_salaried"] * 10 +
    ["gig_variable"] * 10 +
    ["stress_spender"] * 10 +
    ["disciplined_saver"] * 10 +
    ["impulse_buyer"] * 10
)

categories = [
    "Food & Dining","Groceries","Transportation","Fuel","Entertainment",
    "Shopping","Rent","Bills","Medicine","Investment","Education","Family"
]

stress_words = ["urgent","help","loan","please","borrow","emergency","due","overdue"]
positive_words = ["saved","discount","bonus","cashback","planned","investment","goal"]

def classify_nwi(category, desc, amount, hour):
    d = desc.lower()

    if category in ["Rent","Bills","Medicine","Groceries","Education","Transportation","Fuel"]:
        label = "need"
    elif category == "Investment":
        label = "investment"
    else:
        label = "want"

    if any(w in d for w in investment_base):
        label = "investment"
    elif any(w in d for w in need_base):
        label = "need"
    elif any(w in d for w in want_base):
        label = "want"

    if hour >= 23 or hour <= 4:
        if category in ["Shopping","Entertainment","Food & Dining"]:
            label = "want"

    if category == "Food & Dining" and amount > 1200:
        label = "want"

    return label

start = datetime(2024, 1, 1)
rows = []

for i, profile in enumerate(profiles, start=1):
    user_id = f"user_{i:03d}"
    balance = random.randint(8000, 60000)

    for day in range(60):
        date = start + timedelta(days=day)
        txns_today = random.randint(3, 7)

        if profile == "stable_salaried" and date.day == 1:
            rows.append([user_id, profile, date.date(), "Income", random.randint(30000, 80000), 10, "monthly salary credited", "investment"])
        elif profile == "gig_variable" and random.random() < 0.18:
            rows.append([user_id, profile, date.date(), "Income", random.randint(1000, 7000), random.randint(9, 22), "gig payment received", "investment"])

        for _ in range(txns_today):
            cat = random.choice(categories)

            if profile == "disciplined_saver":
                cat = random.choices(categories, weights=[2,4,3,2,1,1,2,2,1,5,2,2])[0]
            elif profile == "impulse_buyer":
                cat = random.choices(categories, weights=[5,1,2,1,5,6,1,1,1,1,1,1])[0]
            elif profile == "stress_spender" and day > 42:
                cat = random.choices(categories, weights=[6,1,2,1,5,6,1,1,1,1,1,1])[0]

            base_amount = {
                "Food & Dining": random.randint(150, 1800),
                "Groceries": random.randint(300, 2500),
                "Transportation": random.randint(50, 800),
                "Fuel": random.randint(300, 2500),
                "Entertainment": random.randint(200, 3000),
                "Shopping": random.randint(300, 6000),
                "Rent": random.randint(8000, 25000),
                "Bills": random.randint(500, 5000),
                "Medicine": random.randint(100, 3000),
                "Investment": random.randint(1000, 10000),
                "Education": random.randint(200, 5000),
                "Family": random.randint(500, 6000)
            }[cat]

            hour = random.randint(8, 22)
            if profile == "impulse_buyer" and random.random() < 0.45:
                hour = random.choice([23, 0, 1, 2])

            desc_pool = need_base + want_base + investment_base
            desc = random.choice(desc_pool)

            if profile == "stress_spender" and day > 42 and random.random() < 0.35:
                desc += " " + random.choice(stress_words)

            if profile == "disciplined_saver" and random.random() < 0.35:
                desc += " " + random.choice(positive_words)

            label = classify_nwi(cat, desc, base_amount, hour)

            rows.append([
                user_id, profile, date.date(), cat, float(base_amount), hour, desc, label
            ])

hist = pd.DataFrame(rows, columns=[
    "user_id","profile_type","date","category","amount","hour_of_day","description","nwi_label"
])

hist.to_csv(os.path.join(OUT, "user_histories.csv"), index=False)
print(f"  ✅ user_histories.csv → {len(hist)} rows")


# -----------------------------
# 4. WEEKLY FMI FEATURE DATASET
# -----------------------------

hist["date"] = pd.to_datetime(hist["date"])
hist["week"] = hist["date"].dt.isocalendar().week

weekly_rows = []

for (user_id, week), g in hist.groupby(["user_id", "week"]):
    profile = g["profile_type"].iloc[0]
    total = g["amount"].sum()

    food = g[g["category"] == "Food & Dining"]["amount"].mean()
    grocery = g[g["category"] == "Groceries"]["amount"].mean()
    transport = g[g["category"].isin(["Transportation","Fuel"])]["amount"].mean()
    entertainment = g[g["category"] == "Entertainment"]["amount"].mean()
    shopping = g[g["category"] == "Shopping"]["amount"].mean()

    want_spend = g[g["nwi_label"] == "want"]["amount"].sum()
    need_spend = g[g["nwi_label"] == "need"]["amount"].sum()
    invest_spend = g[g["nwi_label"] == "investment"]["amount"].sum()

    late_night = g[(g["hour_of_day"] >= 23) | (g["hour_of_day"] <= 4)].shape[0]

    stress_count = sum(
        any(w in str(desc).lower() for w in stress_words)
        for desc in g["description"]
    )

    coverage_ratio = round(random.uniform(0.5, 2.8), 2)
    income_on_time = 1
    income_gap_days = random.randint(0, 15)

    is_anom = 0
    if profile in ["stress_spender", "impulse_buyer"]:
        if late_night > 5 or want_spend / max(total, 1) > 0.55 or stress_count > 2:
            is_anom = 1
    if coverage_ratio < 0.8:
        is_anom = 1

    weekly_rows.append({
        "user_id": user_id,
        "week": int(week),
        "avg_food_spend": round(0 if np.isnan(food) else food, 2),
        "avg_grocery_spend": round(0 if np.isnan(grocery) else grocery, 2),
        "avg_transport_spend": round(0 if np.isnan(transport) else transport, 2),
        "avg_entertainment_spend": round(0 if np.isnan(entertainment) else entertainment, 2),
        "avg_shopping_spend": round(0 if np.isnan(shopping) else shopping, 2),
        "avg_total_spend": round(total, 2),
        "spend_std": round(g["amount"].std(), 2),
        "daily_txn_count": round(len(g) / 7, 2),
        "mean_hour_of_day": round(g["hour_of_day"].mean(), 2),
        "late_night_count": late_night,
        "income_gap_days": income_gap_days,
        "income_on_time": income_on_time,
        "savings_rate": round(invest_spend / max(total, 1), 3),
        "want_spend_pct": round(want_spend / max(total, 1), 3),
        "need_spend_pct": round(need_spend / max(total, 1), 3),
        "coverage_ratio": coverage_ratio,
        "missed_savings": 1 if invest_spend < 500 else 0,
        "upi_stress_word_count": stress_count,
        "unique_merchant_count": random.randint(4, 25),
        "repeat_merchant_rate": round(random.uniform(0.2, 0.85), 2),
        "category_spike_count": random.randint(0, 5),
        "profile_type": profile,
        "is_anomalous": is_anom
    })

weekly = pd.DataFrame(weekly_rows)
weekly.to_csv(os.path.join(OUT, "weekly_feature_vectors.csv"), index=False)
print(f"  ✅ weekly_feature_vectors.csv → {len(weekly)} rows")

print("\n🎉 All datasets generated successfully in:", OUT)
print("   Existing files (dataset.csv, models) were NOT modified.")
