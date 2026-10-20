# Classifier v4 evaluation

Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4 joint model.
Both share the current rules.py. On set b the legacy TF-IDF is refit on the same 80% human split.

## a_v4_test_unseen_merchants (n=979)

| metric | legacy | v4 |
|---|---|---|
| category_accuracy | 42.8% | 80.0% |
| category_macro_f1 | 44.9% | 79.6% |
| type_accuracy | 61.6% | 83.4% |
| joint_accuracy | 29.4% | 76.2% |
| auto_accept_coverage | 14.5% | 64.6% |
| auto_accept_precision | 84.5% | 94.3% |
| rule_share | 9.2% | 9.2% |
| p50_latency_ms | 4.6 | 4.2 |

v4 errors (first 40):

- `travel aggent` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `UPI/168859266370/EVENTBRITE/eventbrite@okaxis/KOTAK` expected Entertainment|Want, got Education|Investment (finaura_v4)
- `himalaya` expected Personal Care|Want, got Food & Dining|Want (finaura_v4)
- `parlee` expected Groceries|Need, got Personal Care|Need (finaura_v4)
- `paid 3259.00 for flight return to home` expected Transport & Travel|Need, got Transport & Travel|Want (merchant_rule)
- `Luxury` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `UPI/DR/091436391025/PRABHAT/axl` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `repair bill` expected Housing|Need, got Transport & Travel|Need (finaura_v4)
- `netmatic` expected Utilities & Bills|Need, got Shopping|Want (finaura_v4)
- `Rs 1397 Tata Consumer` expected Health|Need, got Utilities & Bills|Need (finaura_v4)
- `buttter milk` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `paradise` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `infrastructure development company order` expected Housing|Need, got Education|Investment (finaura_v4)
- `moglix` expected Shopping|Want, got Personal Care|Want (finaura_v4)
- `paid life span` expected Health|Want, got Health|Need (finaura_v4)
- `BIL/ONL/761228685289/QUILLA/AXIS` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `ECOM PUR NETMATIC BANGALORE` expected Utilities & Bills|Need, got Shopping|Want (finaura_v4)
- `himmalaya` expected Personal Care|Want, got Misc|Need (finaura_v4)
- `niki war` expected Shopping|Want, got Education|Investment (finaura_v4)
- `UPI-PATEL-583938@ibl` expected Groceries|Need, got Misc|Need (finaura_v4)
- `UPI/526356022939/ETIHAD AIRWAYS/etihadairways@ybl/AXIS` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `hydeerabad` expected Misc|Need, got Health|Need (finaura_v4)
- `UPI-KOTEX-464557@paytm` expected Personal Care|Need, got Shopping|Want (finaura_v4)
- `kitchen countertop` expected Shopping|Want, got Housing|Need (finaura_v4)
- `UPI/403392132839/HYDERABAD/hyderabad@okaxis/AXIS` expected Misc|Need, got Entertainment|Want (finaura_v4)
- `himalaya purchase` expected Personal Care|Want, got Groceries|Need (finaura_v4)
- `paid Rs 4023 for healthy snack` expected Health|Want, got Groceries|Want (finaura_v4)
- `at cognizant` expected Education|Investment, got Health|Want (finaura_v4)
- `frshgo` expected Groceries|Need, got Utilities & Bills|Need (finaura_v4)
- `spent at Patel` expected Groceries|Need, got Misc|Need (finaura_v4)
- `BIL/ONL/453349569240/HERO/SBI` expected Misc|Need, got Entertainment|Want (finaura_v4)
- `netmatic order` expected Utilities & Bills|Need, got Shopping|Want (finaura_v4)
- `2871.00 Patanjali Stores` expected Health|Need, got Groceries|Need (finaura_v4)
- `Moglix Rs 3575` expected Shopping|Want, got Personal Care|Want (finaura_v4)
- `iPad for studies` expected Education|Investment, got Education|Need (finaura_v4)
- `spent at hero` expected Misc|Need, got Entertainment|Want (finaura_v4)
- `182 kitchen countertop` expected Shopping|Want, got Housing|Need (finaura_v4)
- `at bookmyshow` expected Transport & Travel|Want, got Entertainment|Want (merchant_rule)
- `Prabhat bill` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `UPI/DR/886359412307/HIMALAYA/paytm` expected Personal Care|Want, got Food & Dining|Want (finaura_v4)

## b_human_held_out (n=140)

| metric | legacy | v4 |
|---|---|---|
| category_accuracy | 86.4% | 90.0% |
| category_macro_f1 | 85.5% | 88.7% |
| type_accuracy | 80.7% | 87.1% |
| joint_accuracy | 72.1% | 81.4% |
| auto_accept_coverage | 55.0% | 73.6% |
| auto_accept_precision | 94.8% | 93.2% |
| rule_share | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.0 |

v4 errors (first 40):

- `guitar lessons monthly tutor fee` expected Education|Investment, got Education|Need (finaura_v4)
- `coconut water and fresh produce` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `canva pro design software subscription` expected Utilities & Bills|Need, got Education|Investment (finaura_v4)
- `watch battery replacement local shop` expected Misc|Want, got Transport & Travel|Need (finaura_v4)
- `toefl international english exam fee` expected Education|Need, got Education|Investment (merchant_rule)
- `car service maintenance repair` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `ipl cricket match stadium tickets` expected Entertainment|Want, got Transport & Travel|Want (finaura_v4)
- `country delight pure milk subscription` expected Groceries|Want, got Groceries|Need (merchant_rule)
- `fund transfer to friend miscellaneous` expected Misc|Want, got Debt & Loan Payments|Need (finaura_v4)
- `rooftop bar tapas snacks` expected Food & Dining|Want, got Entertainment|Want (finaura_v4)
- `study abroad consultation counseling fee` expected Education|Investment, got Education|Need (finaura_v4)
- `ice cream sundae parlour` expected Food & Dining|Want, got Personal Care|Want (finaura_v4)
- `notion personal pro annual plan` expected Utilities & Bills|Need, got Education|Investment (finaura_v4)
- `pnb metlife term plan annual payment` expected Insurance|Need, got Investments|Investment (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Want, got Transport & Travel|Need (finaura_v4)
- `private coaching class fees jee neet` expected Education|Need, got Education|Investment (finaura_v4)
- `swimming lessons training coach fee` expected Education|Investment, got Education|Need (finaura_v4)
- `vitamin d and b12 deficiency injections` expected Health|Need, got Health|Want (finaura_v4)
- `motorcycle helmet and riding gear` expected Transport & Travel|Want, got Shopping|Want (finaura_v4)
- `belgian waffle chocolate` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `data analytics offline workshop fee` expected Education|Need, got Education|Investment (finaura_v4)
- `municipal sewage and drainage tax` expected Utilities & Bills|Need, got Housing|Need (finaura_v4)
- `peanut butter and fruit jam` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `board game cafe entry and games` expected Entertainment|Want, got Food & Dining|Want (merchant_rule)
- `traffic police challan fine payment` expected Misc|Need, got Transport & Travel|Need (finaura_v4)
- `apples bananas oranges fruit basket` expected Groceries|Want, got Groceries|Need (finaura_v4)

## c_challenge_adversarial (n=150)

| metric | legacy | v4 |
|---|---|---|
| category_accuracy | 86.0% | 94.7% |
| category_macro_f1 | 87.2% | 95.2% |
| type_accuracy | 86.7% | 94.7% |
| joint_accuracy | 76.7% | 90.7% |
| auto_accept_coverage | 55.3% | 79.3% |
| auto_accept_precision | 98.8% | 96.6% |
| rule_share | 54.0% | 54.0% |
| p50_latency_ms | 0.0 | 0.0 |

v4 errors (first 40):

- `gym membership` expected Health|Want, got Health|Need (finaura_v4)
- `cigarettes` expected Entertainment|Want, got Groceries|Want (finaura_v4)
- `chai sutta` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `mess monthly charges` expected Food & Dining|Need, got Entertainment|Want (finaura_v4)
- `car service at maruti workshop` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `school uniform` expected Shopping|Need, got Education|Need (finaura_v4)
- `yoga classes` expected Health|Want, got Health|Need (finaura_v4)
- `school fees` expected Education|Need, got Education|Investment (merchant_rule)
- `stationery for kids` expected Education|Need, got Shopping|Want (finaura_v4)
- `toothpaste and soap` expected Personal Care|Need, got Personal Care|Want (finaura_v4)
- `sanitary pads` expected Personal Care|Need, got Personal Care|Want (finaura_v4)
- `traffic challan` expected Misc|Need, got Transport & Travel|Need (finaura_v4)
- `tip to delivery guy` expected Misc|Want, got Food & Dining|Want (finaura_v4)
- `gaming chair` expected Shopping|Want, got Entertainment|Want (finaura_v4)
