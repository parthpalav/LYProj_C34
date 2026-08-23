import pandas as pd

eval_data = [
    # --- Merchant-based ---
    {"text": "Zomato", "expected_category": "Food", "expected_type": "Want", "style": "merchant"},
    {"text": "DMart", "expected_category": "Groceries", "expected_type": "Need", "style": "merchant"},
    {"text": "Mumbai Metro", "expected_category": "Travel", "expected_type": "Need", "style": "merchant"},
    {"text": "Netflix", "expected_category": "Entertainment", "expected_type": "Want", "style": "merchant"},
    {"text": "Apollo Pharmacy", "expected_category": "Health", "expected_type": "Need", "style": "merchant"},
    {"text": "Zerodha", "expected_category": "Misc", "expected_type": "Investment", "style": "merchant"},
    {"text": "Uber", "expected_category": "Travel", "expected_type": "Want", "style": "merchant"},
    
    # --- Short natural language ---
    {"text": "ordered dinner after college", "expected_category": "Food", "expected_type": "Want", "style": "short_nl"},
    {"text": "paid electricity bill", "expected_category": "Bills", "expected_type": "Need", "style": "short_nl"},
    {"text": "bought textbooks for semester", "expected_category": "Education", "expected_type": "Investment", "style": "short_nl"},
    {"text": "movie with friends", "expected_category": "Entertainment", "expected_type": "Want", "style": "short_nl"},
    {"text": "monthly SIP investment", "expected_category": "Misc", "expected_type": "Investment", "style": "short_nl"},
    {"text": "got fuel for bike", "expected_category": "Travel", "expected_type": "Need", "style": "short_nl"},
    
    # --- Longer semantic descriptions ---
    {"text": "bought medicines after visiting the doctor", "expected_category": "Health", "expected_type": "Need", "style": "semantic"},
    {"text": "ordered food because I did not cook tonight", "expected_category": "Food", "expected_type": "Want", "style": "semantic"},
    {"text": "purchased headphones during an online sale", "expected_category": "Shopping", "expected_type": "Want", "style": "semantic"},
    {"text": "paid for the train pass I use every day", "expected_category": "Travel", "expected_type": "Need", "style": "semantic"},
    {"text": "transferred money into my monthly mutual fund SIP", "expected_category": "Misc", "expected_type": "Investment", "style": "semantic"},
    
    # --- Ambiguous descriptions (Uncertain/Unknown) ---
    {"text": "Amazon purchase", "expected_category": "Shopping", "expected_type": "Want", "style": "ambiguous"},
    {"text": "payment to Apple", "expected_category": "Shopping", "expected_type": "Want", "style": "ambiguous"},
    {"text": "online payment", "expected_category": "Misc", "expected_type": "Need", "style": "ambiguous"}, # Genuinely ambiguous
    {"text": "subscription", "expected_category": "Entertainment", "expected_type": "Want", "style": "ambiguous"},
    {"text": "shopping", "expected_category": "Shopping", "expected_type": "Want", "style": "ambiguous"},
    {"text": "food", "expected_category": "Food", "expected_type": "Want", "style": "ambiguous"},
    
    # --- Noisy bank/UPI-style descriptions ---
    {"text": "UPI-ZOMATO-ZOMATO@PAYTM", "expected_category": "Food", "expected_type": "Want", "style": "noisy"},
    {"text": "UBER INDIA SYSTEMS PVT LTD", "expected_category": "Travel", "expected_type": "Want", "style": "noisy"},
    {"text": "AMZN Mktp IN", "expected_category": "Shopping", "expected_type": "Want", "style": "noisy"},
    {"text": "NETFLIX.COM", "expected_category": "Entertainment", "expected_type": "Want", "style": "noisy"},
    {"text": "UPI DMART READY", "expected_category": "Groceries", "expected_type": "Need", "style": "noisy"},
]

df = pd.DataFrame(eval_data)
df.to_csv("eval_dataset.csv", index=False)
print(f"Created eval_dataset.csv with {len(df)} examples.")
