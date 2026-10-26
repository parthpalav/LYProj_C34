# Review threshold and ensemble tuning

Threshold picked on synthetic val rows no member trained on; scored through rules + model.
Coverage = share accepted without asking the user; precision = share of those that are right.

## finaura-v5-bge-base-en-v1.5

val rows: 3395, val joint accuracy 85.4%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.85 | 92.1% | 85.0% | 98.3% | 94.9% | 91.1% | 96.5% |
| 0.92 | 0.69 | 92.1% | 95.7% | 94.8% | 94.9% | 94.9% | 95.3% |
| 0.90 | 0.52 | 92.1% | 99.3% | 92.8% | 94.9% | 98.1% | 95.5% |
| 0.88 | 0.40 | 92.1% | 100.0% | 92.1% | 94.9% | 99.4% | 94.9% |
| 0.85 | 0.30 | 92.1% | 100.0% | 92.1% | 94.9% | 99.4% | 94.9% |

## finaura-v6-bge-base-en-v1.5

val rows: 3478, val joint accuracy 85.5%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.87 | 93.6% | 86.4% | 98.3% | 93.6% | 91.1% | 96.5% |
| 0.92 | 0.72 | 93.6% | 90.7% | 96.1% | 93.6% | 97.5% | 94.1% |
| 0.90 | 0.56 | 93.6% | 95.0% | 96.2% | 93.6% | 98.7% | 94.2% |
| 0.88 | 0.40 | 93.6% | 97.9% | 94.9% | 93.6% | 99.4% | 93.6% |
| 0.85 | 0.30 | 93.6% | 99.3% | 94.2% | 93.6% | 100.0% | 93.6% |

## finaura-v5-bge-base-en-v1.5,finaura-v6-bge-base-en-v1.5

val rows: 1589, val joint accuracy 88.9%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.55 | 92.9% | 95.0% | 97.0% | 93.6% | 98.1% | 94.8% |
| 0.92 | 0.39 | 92.9% | 100.0% | 92.9% | 93.6% | 99.4% | 93.6% |
| 0.90 | 0.30 | 92.9% | 100.0% | 92.9% | 93.6% | 99.4% | 93.6% |
| 0.88 | 0.30 | 92.9% | 100.0% | 92.9% | 93.6% | 99.4% | 93.6% |
| 0.85 | 0.30 | 92.9% | 100.0% | 92.9% | 93.6% | 99.4% | 93.6% |
