# FINAURA Research Benchmark Suite

This directory contains the authoritative research benchmarks, experimental metrics, and publication artifacts for **FINAURA: An Explainable Financial Pacing and Multi-Period Stochastic Planning Framework**.

---

## ⚠️ Essential Terminology & Taxonomy Boundaries

To maintain scientific integrity and prevent conflation of different system layers, all documentation and publications must observe the following authoritative distinctions:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. PRODUCTION V3 TAXONOMY & CLASSIFIER ARCHITECTURE                                        │
│    • Dataset: ml-service/dataset.csv (697 samples, 14 canonical categories)                │
│    • Category Classifier: TF-IDF Vectorizer + Logistic Regression (C=5.0, balanced)        │
│    • Type Classifier: sentence-transformers/all-MiniLM-L6-v2 embeddings + Logistic Reg      │
│    • Pipeline: Deterministic Merchant Rules (rules.py) FIRST → Statistical ML Fallback     │
│    • Generalization Metric: 78.54% Macro F1 / 79.29% Accuracy (80/20 Held-Out, N=140)      │
│    • 5-Fold Stratified CV: 78.46% ± 1.40% Macro F1 / 79.48% ± 1.21% Accuracy               │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. HYBRID BLIND CHALLENGE EVALUATION                                                       │
│    • Scope: 68 diverse unseen test queries across all 14 categories                        │
│    • Combined System Performance: 98.5% Category Accuracy, 91.2% Type Accuracy            │
│    • Resolution: 55.9% by Merchant Rules (38 queries), 44.1% by ML Fallback (30 queries)   │
│    • Uncertainty Flagging: 35.3% of queries flagged for human review (confidence < 0.60)   │
│    • CRITICAL: This is a hybrid end-to-end system test; it is NOT raw held-out ML accuracy. │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. LEGACY / EXPERIMENTAL CORPORA (NOT PRODUCTION V3)                                        │
│    • Files: exp2_train_data.csv (10,300 rows), finaura_training_data.csv (9,342 rows)      │
│    • Historical Experiment 2 Macro F1: ~93.4% achieved on an older 9-category synthetic set│
│    • Status: Incompatible with the 14-category Canonical V3 taxonomy.                      │
│    • CRITICAL: Historical ~93.4% metrics must NEVER be cited as Production V3 performance. │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Canonical 14-Category V3 Taxonomy

The FINAURA financial engine operates strictly over 14 canonical categories:
1. `Food & Dining` (Discretionary / Want)
2. `Groceries` (Essential / Need)
3. `Transport & Travel` (Commute / Discretionary)
4. `Housing` (Essential / Need)
5. `Utilities & Bills` (Essential / Need)
6. `Debt & Loan Payments` (Financial Obligation / Need)
7. `Shopping` (Discretionary / Want)
8. `Entertainment` (Discretionary / Want)
9. `Health` (Essential / Need)
10. `Education` (Personal Capital / Investment)
11. `Personal Care` (Discretionary / Want)
12. `Insurance` (Financial Protection / Need)
13. `Investments` (Wealth Accumulation / Investment)
14. `Misc` (General Baseline / Need)

---

## Benchmark Reproduction Guide

To execute the benchmark suite and re-generate all results, tables, and figures:

```bash
# From workspace root:
python3 research/scripts/generate_benchmarks.py
```

### Generated Artifacts (`research/results/`)

| Artifact File | Description |
| :--- | :--- |
| `benchmark_summary.md` | Executive research summary with live metadata and environment specs. |
| `benchmark_metrics.json` | Machine-readable metrics payload containing all benchmark outputs. |
| `production_v3_category_metrics.csv` | Summary of Held-Out and 5-Fold Cross-Validation metrics. |
| `production_v3_per_class_metrics.csv` | Precision, Recall, F1-Score, and Support across all 14 categories. |
| `hybrid_blind_metrics.csv` | System resolution rates, accuracy, and review flag rates on 68 blind queries. |
| `monte_carlo_benchmarks.csv` | 10,000-path accumulation percentiles (P10–P90) and funding probabilities. |
| `fmi_characterisation.csv` | Personal FMI golden characterisation fixtures verifying 0.40/0.30/0.30 weights. |
| `family_fmi_characterisation.csv` | Disaggregation proof verifying Family FMI $\neq$ Arithmetic Mean. |
| `research_tables.tex` | Publication-ready LaTeX table fragments for thesis / research papers. |
| `figures/per_class_f1.png` | Horizontal bar chart of per-class F1 performance relative to macro mean. |
| `figures/monte_carlo_percentiles.png` | Terminal wealth dispersion (P10–P90) across Nominal, Real, and Step-Up. |
| `figures/crn_variance_reduction.png` | Empirical variance comparison proving CRN variance reduction. |
| `figures/family_vs_indiv_fmi.png` | Comparison chart demonstrating pooled household FMI vs arithmetic average. |

---

## Mathematical Formulations

### 1. Personal Financial Maturity Index (FMI)
$$\text{FMI} = \text{round}(0.40 \cdot D_1 + 0.30 \cdot D_2 + 0.30 \cdot D_3)$$
- **$D_1$ (Saving Discipline, 40%):** Compares actual monthly investment flow against required monthly savings derived from retirement corpus obligations:
  $$D_1 = f\left(\frac{\text{Actual Investment}}{\text{Required Monthly Saving}}\right)$$
- **$D_2$ (Spending Control, 30%):** Measures non-investment expenditure pacing against effective monthly budget.
- **$D_3$ (Behavioral Risk, 30%):** Evaluates stability with penalties for late-night transactions ($>2$), impulse shopping bursts ($>4$), and Wants exceeding Needs.

### 2. Family FMI (Household Pooling Engine)
Family FMI pools household income, non-investment expenditure, and savings flows:
$$\text{Family FMI} \neq \frac{1}{M} \sum_{m=1}^M \text{FMI}_m$$
Individual retirement goals and balances remain strictly private and unexposed. Only the pooled required savings and pooled flows are evaluated.

### 3. Stochastic Accumulation Process (Median-Anchored GBM)
Monthly portfolio compounding paths follow:
$$\text{Growth Factor}_{t,i} = (1 + r_{\text{geom}})^{1/12} \cdot \exp\left(\frac{\sigma}{\sqrt{12}} \cdot Z_{t,i}\right), \quad Z_{t,i} \sim \mathcal{N}(0, 1)$$
- Median path matches the deterministic geometric compound trajectory.
- Inflation is applied deterministically to convert nominal trajectories into real purchasing power for comparison against estimated FIRE targets.

### 4. Common Random Numbers (CRN) Variance Reduction
When comparing alternative scenario $B$ against baseline scenario $A$:
$$\text{Var}(W_B - W_A) = \text{Var}(W_B) + \text{Var}(W_A) - 2 \text{Cov}(W_A, W_B)$$
By synchronizing random variates $Z_{t,i}$ across paired scenarios ($r_{A,B} > 0$), estimation variance of scenario differences is significantly reduced.

**EMPIRICAL CRN VARIANCE-REDUCTION EVIDENCE:**
- Protocol: 30 repetitions, 2,000 paths per batch, paired CRN comparison vs independent-random-number comparison.
- Observation: In this controlled benchmark, CRN reduced the observed variance of the scenario-difference estimator by 29.09%.
