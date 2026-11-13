# LLM labelling agreement study

Generator: `qwen2.5:7b`, 6,458 lexicon items (merchants + spend phrases, 14 categories).
Blind verifiers: `llama3.1:8b`, `qwen2.5:7b`, `mistral:7b`, `gemma2:9b`. Labels follow data/CATEGORY_RUBRIC.md.

## 1. Verifier agreement with the generator's intended label

| verifier | n | category | type | joint | category kappa |
|---|---|---|---|---|---|
| llama3.1:8b | 6,458 | 87.8% | 85.1% | 77.2% | 0.868 |
| qwen2.5:7b | 6,442 | 88.3% | 83.5% | 76.5% | 0.873 |
| mistral:7b | 6,363 | 77.5% | 79.2% | 63.8% | 0.757 |
| gemma2:9b | 6,446 | 85.7% | 82.5% | 73.3% | 0.846 |

## 2. Self-consistency

`qwen2.5:7b` re-labelling its own items blind agrees on the category 88.3% of the time; the other families agree with it 83.7% on average.

## 3. Inter-rater reliability (category)

Fleiss' kappa across verifiers: **0.864**; across all raters including the generator: **0.852** (n = 6,338 items labelled by every rater).

| rater pair | Cohen's kappa |
|---|---|
| generator vs llama3.1:8b | 0.868 |
| generator vs qwen2.5:7b | 0.873 |
| generator vs mistral:7b | 0.757 |
| generator vs gemma2:9b | 0.846 |
| llama3.1:8b vs qwen2.5:7b | 0.904 |
| llama3.1:8b vs mistral:7b | 0.827 |
| llama3.1:8b vs gemma2:9b | 0.917 |
| qwen2.5:7b vs mistral:7b | 0.809 |
| qwen2.5:7b vs gemma2:9b | 0.892 |
| mistral:7b vs gemma2:9b | 0.830 |

## 4. Majority-vote filtering

Each item is kept only when a strict majority of the generator plus verifiers agree on its category.

| verifiers | kept | kept but relabelled |
|---|---|---|
| llama3.1:8b | 87.8% | 0.0% |
| llama3.1:8b, qwen2.5:7b | 98.5% | 6.8% |
| llama3.1:8b, qwen2.5:7b, mistral:7b | 93.2% | 5.8% |
| llama3.1:8b, qwen2.5:7b, mistral:7b, gemma2:9b | 97.8% | 8.9% |

Per category (all raters), least unanimous first:

| category | n | unanimous | majority = generator | dropped |
|---|---|---|---|---|
| Misc | 351 | 22.8% | 35.3% | 9.4% |
| Utilities & Bills | 346 | 56.1% | 85.0% | 3.8% |
| Shopping | 481 | 57.6% | 90.4% | 1.7% |
| Debt & Loan Payments | 494 | 58.7% | 96.2% | 2.2% |
| Groceries | 493 | 64.5% | 92.3% | 2.2% |
| Housing | 485 | 69.1% | 85.6% | 3.7% |
| Entertainment | 412 | 72.1% | 85.4% | 2.9% |
| Insurance | 419 | 74.2% | 89.3% | 2.1% |
| Transport & Travel | 527 | 76.1% | 86.3% | 2.8% |
| Food & Dining | 502 | 78.7% | 90.8% | 0.8% |
| Investments | 358 | 82.1% | 96.6% | 0.3% |
| Personal Care | 482 | 87.1% | 97.3% | 0.6% |
| Education | 501 | 88.4% | 99.2% | 0.0% |
| Health | 607 | 89.5% | 98.8% | 0.2% |

## 5. Most frequent category confusions

| generator said | verifier said | count |
|---|---|---|
| Misc | Food & Dining | 242 |
| Food & Dining | Groceries | 199 |
| Groceries | Food & Dining | 187 |
| Misc | Shopping | 138 |
| Entertainment | Food & Dining | 131 |
| Misc | Housing | 123 |
| Insurance | Transport & Travel | 115 |
| Debt & Loan Payments | Misc | 112 |
| Housing | Utilities & Bills | 99 |
| Shopping | Education | 97 |
| Insurance | Health | 89 |
| Misc | Transport & Travel | 87 |
| Entertainment | Shopping | 78 |
| Misc | Personal Care | 78 |
| Housing | Shopping | 71 |

## 6. Agreement with people (697 human-written rows, rubric labels)

| model | category acc | category macro-F1 | type acc | joint acc |
|---|---|---|---|---|
| qwen2.5:7b | 93.0% | 93.9% | 89.0% | 86.1% |
| llama3.1:8b | 93.8% | 93.7% | 88.5% | 85.8% |
| mistral:7b | 88.7% | 88.9% | 85.8% | 80.3% |
| gemma2:9b | 98.3% | 99.0% | 93.4% | 93.4% |

Majority vote of all 4 models decides 94.5% of rows, 98.6% correct when it decides (93.3% over all rows).

Per-category accuracy:

| category | n | qwen2.5:7b | llama3.1:8b | mistral:7b | gemma2:9b |
|---|---|---|---|---|---|
| Debt & Loan Payments | 50 | 84.0% | 96.0% | 74.0% | 100.0% |
| Education | 54 | 98.1% | 90.7% | 63.0% | 90.7% |
| Entertainment | 53 | 98.1% | 94.3% | 96.2% | 98.1% |
| Food & Dining | 49 | 100.0% | 100.0% | 98.0% | 100.0% |
| Groceries | 50 | 100.0% | 100.0% | 98.0% | 100.0% |
| Health | 50 | 100.0% | 100.0% | 100.0% | 100.0% |
| Housing | 54 | 77.8% | 87.0% | 88.9% | 98.1% |
| Insurance | 50 | 100.0% | 100.0% | 100.0% | 96.0% |
| Investments | 50 | 100.0% | 100.0% | 98.0% | 100.0% |
| Misc | 35 | 88.6% | 97.1% | 94.3% | 94.3% |
| Personal Care | 50 | 80.0% | 96.0% | 90.0% | 100.0% |
| Shopping | 52 | 92.3% | 96.2% | 92.3% | 98.1% |
| Transport & Travel | 51 | 98.0% | 100.0% | 94.1% | 100.0% |
| Utilities & Bills | 49 | 83.7% | 57.1% | 57.1% | 100.0% |
