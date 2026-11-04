# Classifier v5 evaluation

Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4. v5 = rules + ensemble ['finaura-v5-bge-base-en-v1.5']. candidate = rules + finaura-v6-bge-base-en-v1.5.
All share the current rules.py. On sets b/b0 the legacy TF-IDF is refit on the same 80% human split.

## a_synthetic_unseen_merchants (n=3468)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 45.1% | 73.2% | 90.1% | 96.7% |
| category_macro_f1 | 49.1% | 72.4% | 89.5% | 96.4% |
| type_accuracy | 62.9% | 77.2% | 89.3% | 93.8% |
| joint_accuracy | 32.8% | 64.0% | 84.9% | 92.5% |
| auto_accept_coverage | 17.0% | 54.0% | 79.8% | 84.0% |
| auto_accept_precision | 93.4% | 80.9% | 93.3% | 95.1% |
| rule_share | 13.9% | 13.9% | 13.9% | 13.9% |
| p50_latency_ms | 4.1 | 4.3 | 15.3 | 15.2 |

candidate errors (first 40):

- `urbnest` expected Shopping|Want, got Housing|Need (finaura_v4)
- `the good erth` expected Food & Dining|Want, got Health|Need (finaura_v4)
- `UPI/DR/426758019006/NEXA EDUCATION/okhdfcbank` expected Education|Investment, got Education|Need (finaura_v4)
- `POS 0384 THE GOOD EARTH HYDERABAD` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `new kurta for work` expected Shopping|Want, got Utilities & Bills|Need (finaura_v4)
- `UPI/DR/524437239350/CREST COACHING/okaxis` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI-NISHANAIR-946249@axl` expected Misc|Need, got Utilities & Bills|Need (finaura_v4)
- `music lessons for priya` expected Education|Investment, got Education|Need (finaura_v4)
- `mgm college` expected Education|Investment, got Education|Need (finaura_v4)
- `Rapid Classes` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI-URBANEST-986081@okicici` expected Shopping|Want, got Housing|Need (finaura_v4)
- `UPI/DR/966628846337/WHIZ EDUCATION/upi` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI-ROHITIYER-107020@okaxis` expected Misc|Need, got Shopping|Want (finaura_v4)
- `The Good Earth 256` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `growmybsket` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `uulaa car` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `sharma antiiquarian books` expected Misc|Need, got Investments|Investment (finaura_v4)
- `career choices payment` expected Education|Investment, got Education|Need (finaura_v4)
- `paid 532 for course prep` expected Education|Investment, got Education|Need (finaura_v4)
- `Crest Coaching payment` expected Education|Investment, got Education|Need (finaura_v4)
- `new light bulbs` expected Housing|Need, got Shopping|Want (finaura_v4)
- `TechPoint` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/554747640513/TATA PLAY GOLD/tataplaygold@ybl/YESB` expected Entertainment|Want, got Utilities & Bills|Need (merchant_rule)
- `college books` expected Education|Investment, got Education|Need (finaura_v4)
- `NEFT DR-ICICIN142668952-BLINKIES` expected Personal Care|Want, got Shopping|Want (finaura_v4)
- `kishore waatches` expected Shopping|Want, got Food & Dining|Want (finaura_v4)
- `driveehail` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `Scholar's Haven 4426` expected Education|Investment, got Education|Need (finaura_v4)
- `narayan's online courses` expected Education|Investment, got Education|Need (finaura_v4)
- `gmegeeks` expected Entertainment|Want, got Shopping|Want (finaura_v4)
- `carer choices` expected Education|Investment, got Misc|Want (finaura_v4)
- `UPI/248431887987/EDUREKA/edureka@paytm/HDFC` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/DR/039161028111/RIDERUSH/oksbi` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `Shri Ram 4864` expected Education|Investment, got Education|Need (finaura_v4)
- `ggurugift` expected Shopping|Want, got Investments|Investment (finaura_v4)
- `friend's emergency fund` expected Misc|Want, got Misc|Need (finaura_v4)
- `whispers saloon` expected Personal Care|Want, got Entertainment|Want (finaura_v4)
- `BIL/ONL/489874294499/CAREER CHOICES/ICICI` expected Education|Investment, got Education|Need (finaura_v4)
- `paid Rs 3890 for friend's emergency fund` expected Misc|Want, got Misc|Need (finaura_v4)
- `Shri Ram` expected Education|Investment, got Education|Need (finaura_v4)

## b_human_held_out_rubric (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.4% | 91.4% | 92.9% | 95.0% |
| category_macro_f1 | 85.5% | 90.1% | 92.5% | 94.7% |
| type_accuracy | 78.6% | 96.4% | 97.1% | 97.9% |
| joint_accuracy | 68.6% | 88.6% | 92.1% | 93.6% |
| auto_accept_coverage | 55.0% | 73.6% | 82.9% | 77.9% |
| auto_accept_precision | 98.7% | 99.0% | 99.1% | 99.1% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `belgian waffle chocolate` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `rooftop bar tapas snacks` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `motorcycle helmet and riding gear` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `bicycle repair and chain replacement` expected Transport & Travel|Need, got Misc|Need (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `notion personal pro annual plan` expected Utilities & Bills|Need, got Insurance|Need (finaura_v4)
- `doctor general physician consultation fee` expected Health|Need, got Insurance|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Need, got Personal Care|Want (finaura_v4)

## b0_human_held_out_original_labels (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 87.1% | 90.7% | 93.6% | 95.7% |
| category_macro_f1 | 86.2% | 89.4% | 93.2% | 95.5% |
| type_accuracy | 80.0% | 88.6% | 88.6% | 88.6% |
| joint_accuracy | 72.1% | 82.1% | 83.6% | 84.3% |
| auto_accept_coverage | 55.0% | 73.6% | 82.9% | 77.9% |
| auto_accept_precision | 94.8% | 94.2% | 90.5% | 92.7% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `guitar lessons monthly tutor fee` expected Education|Investment, got Education|Need (finaura_v4)
- `coconut water and fresh produce` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `bicycle repair and chain replacement` expected Transport & Travel|Need, got Misc|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `watch battery replacement local shop` expected Misc|Want, got Misc|Need (finaura_v4)
- `country delight pure milk subscription` expected Groceries|Want, got Groceries|Need (merchant_rule)
- `coursera machine learning specialization` expected Education|Investment, got Education|Need (merchant_rule)
- `fund transfer to friend miscellaneous` expected Misc|Want, got Misc|Need (finaura_v4)
- `study abroad consultation counseling fee` expected Education|Investment, got Education|Need (finaura_v4)
- `doctor general physician consultation fee` expected Health|Need, got Insurance|Need (finaura_v4)
- `notion personal pro annual plan` expected Utilities & Bills|Need, got Insurance|Need (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Want, got Personal Care|Want (finaura_v4)
- `swimming lessons training coach fee` expected Education|Investment, got Education|Need (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `edx professional certificate program` expected Education|Investment, got Education|Need (merchant_rule)
- `motorcycle helmet and riding gear` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `belgian waffle chocolate` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `random street payment barcode scan` expected Misc|Want, got Misc|Need (finaura_v4)
- `linkedin learning monthly membership` expected Education|Investment, got Education|Need (finaura_v4)
- `peanut butter and fruit jam` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `government document xerox photocopy` expected Misc|Want, got Misc|Need (finaura_v4)
- `apples bananas oranges fruit basket` expected Groceries|Want, got Groceries|Need (finaura_v4)

## c_challenge_adversarial (n=157)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.6% | 94.9% | 96.8% | 95.5% |
| category_macro_f1 | 87.6% | 95.6% | 97.3% | 96.0% |
| type_accuracy | 87.9% | 94.9% | 97.5% | 97.5% |
| joint_accuracy | 78.3% | 91.1% | 94.9% | 93.6% |
| auto_accept_coverage | 57.3% | 80.3% | 87.9% | 79.6% |
| auto_accept_precision | 100.0% | 97.6% | 97.8% | 97.6% |
| rule_share | 56.1% | 56.1% | 56.1% | 56.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `sip of coffee at third wave` expected Food & Dining|Want, got Investments|Investment (finaura_v4)
- `mom birthday gift` expected Shopping|Want, got Misc|Want (finaura_v4)
- `chai sutta` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `auto rickshaw fare` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `parking at phoenix mall` expected Transport & Travel|Need, got Transport & Travel|Want (finaura_v4)
- `bus ticket to pune` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `school uniform` expected Shopping|Need, got Education|Need (finaura_v4)
- `daru for party` expected Entertainment|Want, got Shopping|Want (finaura_v4)
- `traffic challan` expected Misc|Need, got Transport & Travel|Need (finaura_v4)
- `gaming chair` expected Shopping|Want, got Entertainment|Want (finaura_v4)
