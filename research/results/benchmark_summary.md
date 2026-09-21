# FINAURA Research Benchmark Summary

- **Generated At:** `2026-09-21T19:25:09.238897+00:00`
- **Git HEAD:** `f1e0f18a` (`main`)
- **Environment:** Python 3.13.12 on macOS-26.6.2-arm64-arm-64bit-Mach-O

---

## 1. Production V3 Transaction Classifier Performance

The active production transaction classification architecture uses a **Rules-First Hybrid Pipeline**:
1. **Deterministic Merchant Rules:** High-confidence merchant and keyword lookup (`ml-service/classifier/rules.py`).
2. **Statistical ML Fallback:** 
   - **Category:** TF-IDF + Logistic Regression (`tfidf_v2_category_model.pkl`) trained on the canonical 14-category corpus.
   - **Type (Need / Want / Investment):** SentenceTransformer dense embeddings (`sentence-transformers/all-MiniLM-L6-v2`) with a Logistic Regression head (`minilm_v2_type_model.pkl`).

### Production V3 Held-Out & Cross-Validation Metrics
- **Dataset:** `ml-service/dataset.csv` (**697 rows, 14 canonical categories**)
- **Held-Out Test Set (80/20 Stratified Split, N=140):**
  - **Accuracy:** `79.29%`
  - **Macro Precision:** `80.54%`
  - **Macro Recall:** `78.52%`
  - **Macro F1:** `78.54%`
  - **Weighted F1:** `79.14%`
- **5-Fold Stratified Cross-Validation:**
  - **Mean CV Accuracy:** `79.48% ± 1.21%`
  - **Mean CV Macro F1:** `78.46% ± 1.40%`

### Hybrid Blind Challenge Set Evaluation
- **Evaluation Set:** 68 diverse unseen real-world queries spanning all 14 categories.
- **Hybrid Category Accuracy:** `98.5%` (67/68 correct)
- **Hybrid Type Accuracy:** `91.2%` (62/68 correct)
- **Architecture Split:** 38 queries resolved by merchant rules (55.9%), 30 queries resolved by statistical ML fallback (44.1%).
- **Review Flag Rate:** 35.3% (24/68 queries flagged for review due to confidence < 0.60 or margin < 0.15).

> [!NOTE]
> **Scientific Clarification:** The **98.5%** figure is the **Hybrid Blind Challenge Set accuracy** (reflecting production rules + ML combined). The **raw machine learning generalization capability** on held-out text is **78.54% Macro F1 / 79.29% Accuracy**. These figures represent two different layers of the pipeline and must never be conflated.

---

## 2. Legacy / Experimental Corpus Separation

The repository contains offline research artifacts from earlier exploratory phases:
- `ml-service/classifier/exp2_train_data.csv` (10,300 rows, 9 categories)
- `ml-service/classifier/exp2_val_data.csv` (1,500 rows, 9 categories)
- `ml-service/classifier/exp2_test_data.csv` (2,700 rows, 9 categories)
- `ml-service/classifier/finaura_training_data.csv` (9,342 rows, 9 categories)
- `ml-service/Finaura Dataset V2.csv` (1,000 rows, 10 categories)

> [!WARNING]
> Historical research claims of **~93.4% Macro F1** were produced during **Experiment 2** on an older synthetic corpus using a **9-category taxonomy**. This historical result **does NOT apply to Production V3**, which operates on a granular **14-category canonical taxonomy**. The active production category model is TF-IDF + Logistic Regression trained on the authoritative 697-sample dataset.

---

## 3. Monte Carlo Simulation & CRN Verification

- **Path Count:** 10,000 stochastic simulation paths.
- **Terminal Horizon:** 20 years (240 months) to target retirement at age 50.
- **Scenarios Evaluated:**
  - **Nominal Flat:** 2.4% funding probability, Median Real Corpus: ₹8,826,026.
  - **Step-Up (10% Annual):** 16.7% funding probability, Median Real Corpus: ₹16,269,112.
  - **Real Constant:** 8.2% funding probability, Median Real Corpus: ₹12,736,133.
- **Contribution Solver (75% Target):** Determines that increasing monthly investment from ₹25,000 to **₹114,000/mo** achieves the 75% funding probability milestone.
- **Funded Age Solver:** Identifies that with flat ₹25,000/mo savings, 75% funding probability is achieved at age 77.75.

### Common Random Numbers (CRN) Variance Reduction
- **Benchmark Protocol:** EMPIRICAL CRN VARIANCE-REDUCTION EVIDENCE
  - **Repetitions:** 30 simulation batches
  - **Sample Size:** 2,000 stochastic paths per batch
  - **Comparison:** Paired Common Random Numbers (CRN) vs independent-random-number comparison
- **Controlled Benchmark Result:** In this controlled benchmark, CRN reduced the observed variance of the scenario-difference estimator by 29.09% (observed IRN variance: 6.7714e-05, CRN variance: 4.8013e-05, empirical variance reduction: 29.09%).

---

## 4. Financial Maturity Index (FMI) Characterisation

- **Official Personal FMI Formula:**
  $$\text{FMI} = \text{round}(0.40 \cdot D_1 + 0.30 \cdot D_2 + 0.30 \cdot D_3)$$
  clamped to $[0, 100]$.
- **Pillar Semantics:**
  - **$D_1$ (Saving Discipline, 40% weight):** Ratio of actual investment to retirement saving obligation.
  - **$D_2$ (Spending Control, 30% weight):** Discretionary spend control relative to disposable income.
  - **$D_3$ (Behavioral Risk, 30% weight):** Baseline 100 with penalties for late-night transactions, impulse spikes, and Wants exceeding Needs.
- **Family FMI Engine:**
  Evaluates pooled household savings against summed retirement obligations.
  - **Mathematical Proof:** Family FMI is **not** the arithmetic average of individual member scores:
    $$\text{Family FMI} (83) \neq \frac{\text{Member A} (79) + \text{Member B} (82)}{2} = 80.5$$
