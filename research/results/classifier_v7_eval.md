# Classifier v5 evaluation

Legacy = rules + TF-IDF category + MiniLM type head. v4 = rules + finaura-v4. v5 = rules + ensemble ['finaura-v6-bge-base-en-v1.5']. candidate = rules + finaura-v7-bge-base-en-v1.5.
All share the current rules.py. On sets b/b0 the legacy TF-IDF is refit on the same 80% human split.

## a_synthetic_unseen_merchants (n=3468)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 45.2% | 73.3% | 96.9% | 90.3% |
| category_macro_f1 | 49.1% | 72.4% | 96.6% | 89.8% |
| type_accuracy | 62.9% | 77.1% | 93.9% | 88.4% |
| joint_accuracy | 32.9% | 64.0% | 92.6% | 83.8% |
| auto_accept_coverage | 17.0% | 54.2% | 90.9% | 93.0% |
| auto_accept_precision | 93.4% | 80.9% | 95.1% | 87.1% |
| rule_share | 14.0% | 14.0% | 14.0% | 14.0% |
| p50_latency_ms | 4.6 | 4.1 | 15.5 | 15.6 |

candidate errors (first 40):

- `POS 5642 RESIRENT KOLKATA` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `magic circs` expected Entertainment|Want, got Transport & Travel|Want (finaura_v4)
- `ev charge for holiday 1378` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `UPI/985207489412/GODDESS TEMPLE/goddesstemple@ibl/ICICI` expected Misc|Need, got Misc|Want (finaura_v4)
- `paid livspace` expected Housing|Need, got Shopping|Want (finaura_v4)
- `UPI-BIRLASUNLIFEMUTUAL-416283@okicici` expected Investments|Investment, got Insurance|Need (finaura_v4)
- `urbnest` expected Shopping|Want, got Housing|Need (finaura_v4)
- `BIL/ONL/420949407929/CHANNA DA SAA/SBI` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `the good erth` expected Food & Dining|Want, got Personal Care|Want (finaura_v4)
- `UPI/DR/426758019006/NEXA EDUCATION/okhdfcbank` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/DR/964798094233/SPRING HEALTH/ibl` expected Health|Want, got Health|Need (finaura_v4)
- `kedem` expected Personal Care|Want, got Misc|Need (finaura_v4)
- `chitra handcrafts` expected Misc|Need, got Shopping|Want (finaura_v4)
- `paid 2087.00 for tissues` expected Groceries|Need, got Misc|Need (finaura_v4)
- `Renu Tailor` expected Shopping|Need, got Misc|Need (finaura_v4)
- `bajaaj electricals` expected Utilities & Bills|Need, got Shopping|Want (finaura_v4)
- `POS 0384 THE GOOD EARTH HYDERABAD` expected Food & Dining|Want, got Shopping|Want (finaura_v4)
- `irnfit` expected Health|Want, got Transport & Travel|Want (finaura_v4)
- `UPI/DR/524437239350/CREST COACHING/okaxis` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI-SRIVASTAVAHOUSEFEE-020331@paytm` expected Housing|Need, got Food & Dining|Want (finaura_v4)
- `3475.00 Om Tiffin Express` expected Food & Dining|Want, got Food & Dining|Need (finaura_v4)
- `UPI-NISHANAIR-946249@axl` expected Misc|Need, got Transport & Travel|Want (finaura_v4)
- `primepek` expected Health|Want, got Misc|Need (finaura_v4)
- `livspac` expected Housing|Need, got Entertainment|Want (finaura_v4)
- `1949.00 Channa da saa` expected Food & Dining|Want, got Groceries|Want (finaura_v4)
- `IDFC Bank 2912.00` expected Investments|Investment, got Debt & Loan Payments|Need (finaura_v4)
- `Luxe payment` expected Personal Care|Want, got Shopping|Want (finaura_v4)
- `UPI-BAJAJALLIANZPERSONALACCIDENT-210089@ybl` expected Insurance|Need, got Health|Need (finaura_v4)
- `UPI/DR/012769308708/JOHNSON'S/upi` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `music lessons for priya` expected Education|Investment, got Education|Need (finaura_v4)
- `mgm college` expected Education|Investment, got Education|Need (finaura_v4)
- `Rapid Classes` expected Education|Investment, got Education|Need (finaura_v4)
- `UPI/DR/966628846337/WHIZ EDUCATION/upi` expected Education|Investment, got Education|Need (finaura_v4)
- `The Good Earth 256` expected Food & Dining|Want, got Shopping|Want (finaura_v4)
- `unilever order` expected Personal Care|Want, got Groceries|Need (finaura_v4)
- `sharma antiiquarian books` expected Misc|Need, got Education|Need (finaura_v4)
- `Gillette` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `vip  x` expected Entertainment|Want, got Misc|Need (finaura_v4)
- `NEFT DR-SBIN638175282-GODDESS TEMPLE` expected Misc|Need, got Misc|Want (finaura_v4)
- `mumbaitraffic bill` expected Transport & Travel|Need, got Misc|Need (finaura_v4)

## b_human_held_out_rubric (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.4% | 91.4% | 95.0% | 95.7% |
| category_macro_f1 | 85.5% | 90.1% | 94.7% | 95.5% |
| type_accuracy | 78.6% | 96.4% | 97.9% | 96.4% |
| joint_accuracy | 68.6% | 88.6% | 93.6% | 93.6% |
| auto_accept_coverage | 55.0% | 73.6% | 86.4% | 96.4% |
| auto_accept_precision | 98.7% | 99.0% | 98.3% | 95.6% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `rooftop bar tapas snacks` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `peanut butter and fruit jam` expected Groceries|Need, got Groceries|Want (finaura_v4)
- `apartment intercom maintenance` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `lenskart polarized sunglasses` expected Shopping|Want, got Shopping|Need (finaura_v4)
- `linkedin learning monthly membership` expected Education|Need, got Utilities & Bills|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `fund transfer to friend miscellaneous` expected Misc|Need, got Investments|Investment (finaura_v4)
- `random street payment barcode scan` expected Misc|Need, got Entertainment|Want (finaura_v4)

## b0_human_held_out_original_labels (n=140)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 87.1% | 90.7% | 95.7% | 96.4% |
| category_macro_f1 | 86.2% | 89.4% | 95.5% | 96.2% |
| type_accuracy | 80.0% | 88.6% | 88.6% | 89.3% |
| joint_accuracy | 72.1% | 82.1% | 84.3% | 87.1% |
| auto_accept_coverage | 55.0% | 73.6% | 86.4% | 96.4% |
| auto_accept_precision | 94.8% | 94.2% | 90.9% | 88.9% |
| rule_share | 52.1% | 52.1% | 52.1% | 52.1% |
| p50_latency_ms | 0.1 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `guitar lessons monthly tutor fee` expected Education|Investment, got Education|Need (finaura_v4)
- `coconut water and fresh produce` expected Groceries|Want, got Groceries|Need (finaura_v4)
- `electric toothbrush oral-b heads` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `watch battery replacement local shop` expected Misc|Want, got Misc|Need (finaura_v4)
- `country delight pure milk subscription` expected Groceries|Want, got Groceries|Need (merchant_rule)
- `coursera machine learning specialization` expected Education|Investment, got Education|Need (merchant_rule)
- `lenskart polarized sunglasses` expected Shopping|Want, got Shopping|Need (finaura_v4)
- `fund transfer to friend miscellaneous` expected Misc|Want, got Investments|Investment (finaura_v4)
- `study abroad consultation counseling fee` expected Education|Investment, got Education|Need (finaura_v4)
- `pos unknown retail counter swipe` expected Misc|Want, got Misc|Need (finaura_v4)
- `swimming lessons training coach fee` expected Education|Investment, got Education|Need (finaura_v4)
- `kitchen gas pipeline maintenance mgl` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `edx professional certificate program` expected Education|Investment, got Education|Need (merchant_rule)
- `random street payment barcode scan` expected Misc|Want, got Entertainment|Want (finaura_v4)
- `apartment intercom maintenance` expected Housing|Need, got Utilities & Bills|Need (finaura_v4)
- `linkedin learning monthly membership` expected Education|Investment, got Utilities & Bills|Need (finaura_v4)
- `government document xerox photocopy` expected Misc|Want, got Misc|Need (finaura_v4)
- `apples bananas oranges fruit basket` expected Groceries|Want, got Groceries|Need (finaura_v4)

## c_challenge_adversarial (n=157)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 86.6% | 94.9% | 95.5% | 98.1% |
| category_macro_f1 | 87.6% | 95.6% | 96.0% | 97.9% |
| type_accuracy | 87.9% | 94.9% | 97.5% | 100.0% |
| joint_accuracy | 78.3% | 91.1% | 93.6% | 98.1% |
| auto_accept_coverage | 57.3% | 80.3% | 91.1% | 96.8% |
| auto_accept_precision | 100.0% | 97.6% | 96.5% | 98.7% |
| rule_share | 56.1% | 56.1% | 56.1% | 56.1% |
| p50_latency_ms | 0.0 | 0.0 | 0.0 | 0.0 |

candidate errors (first 40):

- `chai sutta` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `paracetamol` expected Health|Need, got Personal Care|Need (finaura_v4)
- `kotak 811 transfer` expected Misc|Need, got Debt & Loan Payments|Need (finaura_v4)

## e_gold_v7 (n=926)

| metric | legacy | v4 | v5 | candidate |
|---|---|---|---|---|
| category_accuracy | 57.9% | 63.0% | 71.4% | 94.5% |
| category_macro_f1 | 62.5% | 63.8% | 72.4% | 94.7% |
| type_accuracy | 66.0% | 77.5% | 84.8% | 97.0% |
| joint_accuracy | 43.1% | 59.4% | 69.7% | 93.7% |
| auto_accept_coverage | 25.9% | 56.8% | 63.8% | 91.1% |
| auto_accept_precision | 95.4% | 79.7% | 87.5% | 97.9% |
| rule_share | 24.5% | 24.5% | 24.5% | 24.5% |
| p50_latency_ms | 4.2 | 4.0 | 14.4 | 14.5 |

candidate errors (first 40):

- `UPI/388853933633/UPI/naturalsicecre@oksbi/ICICI BANK` expected Food & Dining|Want, got Personal Care|Want (finaura_v4)
- `UPI/136134125242/Paid via PhonePe/hotelsagarfami@hdfcbank/AXIS BANK` expected Food & Dining|Want, got Transport & Travel|Want (finaura_v4)
- `UPI-NILGIRIS-NILGIRIS@OKICICI-ICIC0DC0099-761740931925-PAYMENT FROM PHONE` expected Groceries|Need, got Food & Dining|Want (finaura_v4)
- `UPI/640410423468/Paid via PhonePe/vishalmegamart@okaxis/AXIS BANK` expected Groceries|Need, got Health|Need (finaura_v4)
- `UPI/461073587355/UPI/nayaraenergy@icici/ICICI BANK` expected Transport & Travel|Need, got Utilities & Bills|Need (finaura_v4)
- `VPS/TATA POWER EZ CHARGE/381444945443/AHMEDABAD` expected Transport & Travel|Need, got Utilities & Bills|Need (merchant_rule)
- `TO TRANSFER-UPI/DR/055987490606/SAI KRUPA COOPERATIV/YESB/saikrupacooper@paytm/UPI--` expected Housing|Need, got Debt & Loan Payments|Need (finaura_v4)
- `UPI/235341213622/Paid via PhonePe/prestigelakesi@ibl/KOTAK MAHINDRA BANK` expected Housing|Need, got Transport & Travel|Want (finaura_v4)
- `watchman diwali bonus 2492` expected Housing|Need, got Entertainment|Want (finaura_v4)
- `UPI/P2M/462704534577/UPPCL/UPI/PAYTM PAYMENTS BANK` expected Utilities & Bills|Need, got Misc|Need (finaura_v4)
- `TO TRANSFER-UPI/DR/457658485371/HATHWAY/HDFC/hathway33@ybl/Payment--` expected Utilities & Bills|Need, got Debt & Loan Payments|Need (finaura_v4)
- `Excitel 4853` expected Utilities & Bills|Need, got Transport & Travel|Want (finaura_v4)
- `postpaid bill 1474` expected Utilities & Bills|Need, got Debt & Loan Payments|Need (finaura_v4)
- `UPI-LIC HOUSING FINANCE-LICHOUSINGFINA@YBL-UTIB0000553-997175546157-PAYMENT FROM PHONE` expected Debt & Loan Payments|Need, got Insurance|Need (merchant_rule)
- `PCD/7106/HDFC CREDIT CARD/AHMEDABAD/243295` expected Debt & Loan Payments|Need, got Housing|Need (finaura_v4)
- `VPS/ICICI CREDIT CARD/905878115356/LUCKNOW` expected Debt & Loan Payments|Need, got Housing|Need (finaura_v4)
- `UPI-DISTRICT BY ZOMATO-DISTRICTBYZOMA78@YBL-YESB0YBLUPI-053516693481-PAYMENT FROM PHONE` expected Entertainment|Want, got Food & Dining|Want (merchant_rule)
- `TASMAC` expected Entertainment|Want, got Transport & Travel|Want (finaura_v4)
- `daru aur chakna` expected Entertainment|Want, got Food & Dining|Want (finaura_v4)
- `TO TRANSFER-UPI/DR/436684432038/GREEN TRENDS/HDFC/greentrends@ybl/UPI--` expected Personal Care|Want, got Shopping|Want (finaura_v4)
- `PCD/4762/BOMBAY SHAVING COMPA/MUMBAI/202743` expected Personal Care|Want, got Personal Care|Need (finaura_v4)
- `TO TRANSFER-UPI/DR/499813274394/COLGATE/YESB/colgate@hdfcbank/Paid--` expected Personal Care|Need, got Education|Need (finaura_v4)
- `UPI/721894863540/Payment from Ph/paragparikhmut@axl/KOTAK MAHINDRA BANK` expected Investments|Investment, got Misc|Need (finaura_v4)
- `UPI/035182105655/Payment from Ph/srisaienterpri30@axl/PAYTM PAYMENTS BANK` expected Misc|Need, got Entertainment|Want (finaura_v4)
- `NWD-512345XXXXXX1234-S1ANMU12-MUMBAI` expected Misc|Need, got Housing|Need (finaura_v4)
- `ATW-416021XXXXXX7788-HDFC0412-PUNE` expected Misc|Need, got Health|Need (finaura_v4)
- `MIN BAL CHGS` expected Misc|Need, got Education|Need (finaura_v4)
- `stamp duty for agreement 2720` expected Misc|Need, got Housing|Need (finaura_v4)
- `cobbler for chappal` expected Misc|Need, got Shopping|Want (finaura_v4)
- `split dinner bill with friends` expected Misc|Need, got Food & Dining|Want (finaura_v4)
- `Fipola 579` expected Groceries|Need, got Groceries|Want (finaura_v4)
- `UPI/NAMMA YATRI/647649755459/Payment from Ph` expected Transport & Travel|Want, got Transport & Travel|Need (finaura_v4)
- `UPI-SHANTI NIKETAN COOPERATIVE SOCIETY-SHANTINIKETANC@ICICI-HDFC0MERUPI-326596442371-UPI` expected Housing|Need, got Debt & Loan Payments|Need (finaura_v4)
- `UPI/799256343909/UPI/shreeramgasser94@icici/HDFC BANK` expected Utilities & Bills|Need, got Health|Want (finaura_v4)
- `VPS/FLIPKART PAY LATER/475671024098/INDORE` expected Debt & Loan Payments|Need, got Shopping|Want (merchant_rule)
- `NACH-DR-HOME CREDIT INDIA-412345678901` expected Debt & Loan Payments|Need, got Housing|Need (finaura_v4)
- `PCD/3825/LIFESTYLE STORES/HYDERABAD/934439` expected Shopping|Want, got Groceries|Need (finaura_v4)
- `school shoes for daughter 367` expected Shopping|Need, got Shopping|Want (merchant_rule)
- `UPI/031563635936/UPI/asterdmhealthc@icici/YES BANK LIMITED YBS` expected Health|Need, got Insurance|Need (finaura_v4)
- `UPI/914451746993/Paid via PhonePe/jawaharlalnehr26@okicici/ICICI BANK` expected Education|Need, got Health|Need (finaura_v4)
