# Review threshold and ensemble tuning

Threshold picked on synthetic val rows no member trained on; scored through rules + model.
Coverage = share accepted without asking the user; precision = share of those that are right.

## finaura-v6-bge-base-en-v1.5

val rows: 3478, val joint accuracy 85.7%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.87 | 93.6% | 86.4% | 98.3% | 93.6% | 91.1% | 96.5% |
| 0.92 | 0.72 | 93.6% | 90.7% | 96.1% | 93.6% | 97.5% | 94.1% |
| 0.90 | 0.56 | 93.6% | 95.0% | 96.2% | 93.6% | 98.7% | 94.2% |
| 0.88 | 0.40 | 93.6% | 97.9% | 94.9% | 93.6% | 99.4% | 93.6% |
| 0.85 | 0.30 | 93.6% | 99.3% | 94.2% | 93.6% | 100.0% | 93.6% |

## finaura-v7a-bge-base-en-v1.5

val rows: 3228, val joint accuracy 87.5%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.78 | 94.3% | 96.4% | 95.6% | 96.8% | 94.9% | 98.0% |
| 0.92 | 0.52 | 94.3% | 99.3% | 94.2% | 96.8% | 98.1% | 98.1% |
| 0.90 | 0.43 | 94.3% | 100.0% | 94.3% | 96.8% | 99.4% | 97.4% |
| 0.88 | 0.30 | 94.3% | 100.0% | 94.3% | 96.8% | 100.0% | 96.8% |
| 0.85 | 0.30 | 94.3% | 100.0% | 94.3% | 96.8% | 100.0% | 96.8% |

## finaura-v7-bge-base-en-v1.5

val rows: 17478, val joint accuracy 88.4%

| target | threshold | human joint acc | human coverage | human precision | challenge joint acc | challenge coverage | challenge precision |
|---|---|---|---|---|---|---|---|
| 0.95 | 0.78 | 93.6% | 96.4% | 95.6% | 98.1% | 96.8% | 98.7% |
| 0.92 | 0.53 | 93.6% | 98.6% | 94.9% | 98.1% | 99.4% | 98.1% |
| 0.90 | 0.36 | 93.6% | 100.0% | 93.6% | 98.1% | 100.0% | 98.1% |
| 0.88 | 0.30 | 93.6% | 100.0% | 93.6% | 98.1% | 100.0% | 98.1% |
| 0.85 | 0.30 | 93.6% | 100.0% | 93.6% | 98.1% | 100.0% | 98.1% |
