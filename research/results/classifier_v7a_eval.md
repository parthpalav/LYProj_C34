# Classifier v5 evaluation

Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4. v5 = rules + ensemble ['finaura-v6-bge-base-en-v1.5']. candidate = rules + finaura-v7a-bge-base-en-v1.5.
All share the current rules.py. On sets b/b0 the legacy TF-IDF is refit on the same 80% human split.

## a_synthetic_unseen_merchants (n=3468)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 45.2% | 73.3% | 96.9% | 90.3% |
| category_macro_f1 | 49.1% | 72.4% | 96.6% | 89.8% |
| type_accuracy | 62.9% | 77.1% | 93.9% | 88.0% |
| joint_accuracy | 32.9% | 64.0% | 92.6% | 83.5% |
| auto_accept_coverage | 17.0% | 54.2% | 90.9% | 92.4% |
| auto_accept_precision | 93.4% | 80.9% | 95.1% | 87.9% |
| rule_share | 14.0% | 14.0% | 14.0% | 14.0% |
| p50_latency_ms | 4.2 | 4.2 | 16.1 | 16.1 |

candidate errors (first 40):

- `ev charge for holiday 1378` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `UPI/985207489412/GODDESS TEMPLE/goddesstemple@ibl/ICICI` expected Misc|Need, got Misc|Want (finaura_v4)
- `urbnest` expected Shopping|Want, got Housing|Need (finaura_v4)
- `BIL/ONL/420949407929/CHANNA DA SAA/SBI` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `the good erth` expected Food & Dining|Want, got Health|Need (finaura_v4)
- `UPI/DR/426758019006/NEXA EDUCATION/okhdfcbank` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/DR/964798094233/SPRING HEALTH/ibl` expected Health|Want, got Health|Need (finaura_v4)
- `kedem` expected Personal Care|Want, got Misc|Need (finaura_v4)
- `chitra handcrafts` expected Misc|Need, got Shopping|Want (finaura_v4)
- `Renu Tailor` expected Shopping|Need, got Misc|Need (finaura_v4)
- `bajaaj electricals` expected Utilities & Bills|Need, got Shopping|Want (finaura_v4)
- `POS 0384 THE GOOD EARTH HYDERABAD` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `paid ₹890 for paint touch up` expected Housing|Need, got Personal Care|Want (finaura_v4)
- `UPI/DR/524437239350/CREST COACHING/okaxis` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI-SRIVASTAVAHOUSEFEE-020331@paytm` expected Housing|Need, got Misc|Need (finaura_v4)
- `3475.00 Om Tiffin Express` expected Food & Dining|Want, got Food & Dining|Need (finaura_v4)
- `UPI-NISHANAIR-946249@axl` expected Misc|Need, got Utilities & Bills|Need (finaura_v4)
- `primepek` expected Health|Want, got Misc|Need (finaura_v4)
- `livspac` expected Housing|Need, got Health|Need (finaura_v4)
- `1949.00 Channa da saa` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `IDFC Bank 2912.00` expected Investments|Investment, got Misc|Need (finaura_v4)
- `Luxe payment` expected Personal Care|Want, got Shopping|Want (finaura_v4)
- `UPI/DR/012769308708/JOHNSON'S/upi` expected Personal Care|Want, got Health|Need (finaura_v4)
- `music lessons for priya` expected Education|Investment, got Education|Need (finaura_v4)
- `mgm college` expected Education|Investment, got Education|Need (finaura_v4)
- `Rapid Classes` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/DR/966628846337/WHIZ EDUCATION/upi` expected Education|Investment, got Education|Need (finaura_v4)
- `1662 new glasses frame` expected Shopping|Need, got Shopping|Want (finaura_v4)
- `Close Up ₹20` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `The Good Earth 256` expected Food & Dining|Want, got Groceries|Need (finaura_v4)
- `unilever order` expected Personal Care|Want, got Groceries|Need (finaura_v4)
- `sharma antiiquarian books` expected Misc|Need, got Shopping|Want (finaura_v4)
- `vip  x` expected Entertainment|Want, got Misc|Need (finaura_v4)
- `UPI/499808338801/CLOSE UP/closeup@paytm/ICICI` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `NEFT DR-SBIN638175282-GODDESS TEMPLE` expected Misc|Need, got Misc|Want (finaura_v4)
- `mumbaitraffic bill` expected Transport & Travel|Need, got Misc|Need (finaura_v4)
- `career choices payment` expected Education|Investment, got Education|Need (finaura_v4)
- `spent at Goddess Temple` expected Misc|Need, got Misc|Want (finaura_v4)
- `lakshmi gold store payment` expected Investments|Investment, got Shopping|Want (finaura_v4)
- `paid 532 for course prep` expected Education|Investment, got Education|Need (finaura_v4)

## b_human_held_out_rubric (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.4% | 91.4% | 95.0% | 95.0% |
| category_macro_f1 | 85.5% | 90.1% | 94.7% | 94.2% |
| type_accuracy | 78.6% | 96.4% | 97.9% | 97.9% |
| joint_accuracy | 68.6% | 88.6% | 93.6% | 94.3% |
| auto_accept_coverage | 55.0% | 73.6% | 86.4% | 96.4% |
| auto_accept_precision | 98.7% | 99.0% | 98.3% | 95.6% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.1 | 0.0 | 0.0 |

candidate errors (first 40):

- `rooftop bar tapas snacks` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `frozen peas and sweet corn` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `notion personal pro annual plan` expected Utilities & Bills|Need, got Insurance|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `fund transfer to friend miscellaneous` expected Misc|Need, got Investments|Investment (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Need, got Groceries|Need (finaura_v4)
- `watch battery replacement local shop` expected Misc|Need, got Transport & Travel|Need (finaura_v4)

## b0_human_held_out_original_labels (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 87.1% | 90.7% | 95.7% | 95.7% |
| category_macro_f1 | 86.2% | 89.4% | 95.5% | 94.9% |
| type_accuracy | 80.0% | 88.6% | 88.6% | 87.9% |
| joint_accuracy | 72.1% | 82.1% | 84.3% | 86.4% |
| auto_accept_coverage | 55.0% | 73.6% | 86.4% | 96.4% |
| auto_accept_precision | 94.8% | 94.2% | 90.9% | 88.1% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `guitar lessons monthly tutor fee` expected Education|Investment, got Education|Need (finaura_v4)
- `coconut water and fresh produce` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `watch battery replacement local shop` expected Misc|Want, got Transport & Travel|Need (finaura_v4)
- `frozen peas and sweet corn` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `country delight pure milk subscription` expected Groceries|Want, got Groceries|Need (merchant_rule)
- `coursera machine learning specialization` expected Education|Investment, got Education|Need (merchant_rule)
- `fund transfer to friend miscellaneous` expected Misc|Want, got Investments|Investment (finaura_v4)
- `study abroad consultation counseling fee` expected Education|Investment, got Education|Need (finaura_v4)
- `notion personal pro annual plan` expected Utilities & Bills|Need, got Insurance|Need (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Want, got Groceries|Need (finaura_v4)
- `swimming lessons training coach fee` expected Education|Investment, got Education|Need (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `edx professional certificate program` expected Education|Investment, got Education|Need (merchant_rule)
- `random street payment barcode scan` expected Misc|Want, got Misc|Need (finaura_v4)
- `linkedin learning monthly membership` expected Education|Investment, got Education|Need (finaura_v4)
- `peanut butter and fruit jam` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `government document xerox photocopy` expected Misc|Want, got Misc|Need (finaura_v4)
- `apples bananas oranges fruit basket` expected Groceries|Want, got Groceries|Need (finaura_v4)

## c_challenge_adversarial (n=157)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.6% | 94.9% | 95.5% | 97.5% |
| category_macro_f1 | 87.6% | 95.6% | 96.0% | 97.8% |
| type_accuracy | 87.9% | 94.9% | 97.5% | 98.7% |
| joint_accuracy | 78.3% | 91.1% | 93.6% | 96.8% |
| auto_accept_coverage | 57.3% | 80.3% | 91.1% | 94.9% |
| auto_accept_precision | 100.0% | 97.6% | 96.5% | 98.0% |
| rule_share | 56.1% | 56.1% | 56.1% | 56.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `sip of coffee at third wave` expected Food & Dining|Want, got Investments|Investment (finaura_v4)
- `chai sutta` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `mess monthly charges` expected Food & Dining|Need, got Misc|Need (finaura_v4)
- `bus ticket to pune` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `traffic challan` expected Misc|Need, got Transport & Travel|Need (finaura_v4)

## e_gold_v7 (n=926)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 57.9% | 63.0% | 71.4% | 74.1% |
| category_macro_f1 | 62.5% | 63.8% | 72.4% | 75.6% |
| type_accuracy | 66.0% | 77.5% | 84.8% | 88.4% |
| joint_accuracy | 43.1% | 59.4% | 69.7% | 73.2% |
| auto_accept_coverage | 25.9% | 56.8% | 63.8% | 80.9% |
| auto_accept_precision | 95.4% | 79.7% | 87.5% | 83.2% |
| rule_share | 24.5% | 24.5% | 24.5% | 24.5% |
| p50_latency_ms | 4.1 | 4.2 | 15.3 | 15.6 |

candidate errors (first 40):

- `TO TRANSFER-UPI/DR/710497465075/THIRD WAVE COFFEE/UTIB/thirdwavecoffe@okaxis/Paid--` expected Food & Dining|Want, got Misc|Need (finaura_v4)
- `UPI/957117777412/Payment from Ph/wowmomo@paytm/KOTAK MAHINDRA BANK` expected Food & Dining|Want, got Misc|Need (finaura_v4)
- `UPI/388853933633/UPI/naturalsicecre@oksbi/ICICI BANK` expected Food & Dining|Want, got Health|Need (finaura_v4)
- `POS 512345XXXXXX6330 KAILASH PARBAT CHENNAI` expected Food & Dining|Want, got Misc|Need (finaura_v4)
- `UPI-CHITALE BANDHU-CHITALEBANDHU@IBL-PYTM0123456-548620579868-UPI` expected Food & Dining|Want, got Shopping|Want (finaura_v4)
- `VPS/ANNAPOORNA UDUPI HOT/180588871803/HYDERABAD` expected Food & Dining|Want, got Personal Care|Want (finaura_v4)
- `UPI/136134125242/Paid via PhonePe/hotelsagarfami@hdfcbank/AXIS BANK` expected Food & Dining|Want, got Misc|Need (finaura_v4)
- `PCD/4628/LAXMI MISHTHAN BHAND/JAIPUR/975140` expected Food & Dining|Want, got Misc|Need (finaura_v4)
- `Annapurna Mess Pune 1701` expected Food & Dining|Need, got Food & Dining|Want (finaura_v4)
- `late night maggi at the tapri` expected Food & Dining|Want, got Entertainment|Want (finaura_v4)
- `thali at the railway station` expected Food & Dining|Want, got Transport & Travel|Need (finaura_v4)
- `hostel mess bill october` expected Food & Dining|Need, got Transport & Travel|Want (finaura_v4)
- `dabbawala monthly charges` expected Food & Dining|Need, got Utilities & Bills|Need (finaura_v4)
- `UPI-NILGIRIS-NILGIRIS@OKICICI-ICIC0DC0099-761740931925-PAYMENT FROM PHONE` expected Groceries|Need, got Utilities & Bills|Need (finaura_v4)
- `UPI/P2M/515055613044/LULU HYPERMARKET/UPI/YES BANK LIMITED YBS` expected Groceries|Need, got Utilities & Bills|Need (finaura_v4)
- `UPI/640410423468/Paid via PhonePe/vishalmegamart@okaxis/AXIS BANK` expected Groceries|Need, got Misc|Need (finaura_v4)
- `Metro Cash and Carry` expected Groceries|Need, got Transport & Travel|Need (finaura_v4)
- `POS 512345XXXXXX1067 LICIOUS LUCKNOW` expected Groceries|Need, got Entertainment|Want (finaura_v4)
- `al madina chicken centre` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `annapurna super market siliguri` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `PCD/4248/CHOCOLATE JUNCTION/NAGPUR/611148` expected Groceries|Want, got Food & Dining|Want (finaura_v4)
- `phenyl and floor cleaner 1706` expected Groceries|Need, got Housing|Need (finaura_v4)
- `monthly ration list` expected Groceries|Need, got Utilities & Bills|Need (finaura_v4)
- `ghee and sugar for diwali sweets` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `chips and cold drinks for home` expected Groceries|Want, got Food & Dining|Want (finaura_v4)
- `namkeen and biscuits 953` expected Groceries|Want, got Food & Dining|Want (finaura_v4)
- `badam and kaju 500g` expected Groceries|Want, got Utilities & Bills|Need (finaura_v4)
- `UPI/461073587355/UPI/nayaraenergy@icici/ICICI BANK` expected Transport & Travel|Need, got Utilities & Bills|Need (finaura_v4)
- `UPI-JIO BP-JIOBP4@ICICI-ICIC0DC0099-060710431955-PAYMENT FROM PHONE` expected Transport & Travel|Need, got Utilities & Bills|Need (finaura_v4)
- `UPI/BEST UNDERTAKING/885261149131/UPI` expected Transport & Travel|Need, got Misc|Need (finaura_v4)
- `BMTC 1967` expected Transport & Travel|Need, got Health|Need (finaura_v4)
- `VPS/TATA POWER EZ CHARGE/381444945443/AHMEDABAD` expected Transport & Travel|Need, got Utilities & Bills|Need (merchant_rule)
- `UPI-STATIQ-STATIQ@OKICICI-HDFC0MERUPI-493516438831-NA` expected Transport & Travel|Need, got Investments|Investment (finaura_v4)
- `UPI/043103993158/Payment from Ph/mrftyres@hdfcbank/ICICI BANK` expected Transport & Travel|Need, got Misc|Need (finaura_v4)
- `indigo` expected Transport & Travel|Want, got Shopping|Want (finaura_v4)
- `Akasa Air` expected Transport & Travel|Want, got Utilities & Bills|Need (finaura_v4)
- `UPI/P2M/734207509619/IXIGO/Payment/AXIS BANK` expected Transport & Travel|Want, got Misc|Need (finaura_v4)
- `PCD/5169/MSRTC/AHMEDABAD/846493` expected Transport & Travel|Want, got Education|Need (finaura_v4)
- `UPI/INTRCITY SMARTBUS/872009773797/Payment from Ph` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `UPI/P2M/241805788914/SHIV SHAKTI TOURS AN/Payment/KOTAK MAHINDRA BANK` expected Transport & Travel|Want, got Misc|Need (finaura_v4)
