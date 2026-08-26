# FINAURA PREDICTABILITY ENGINE V2
## CANONICAL PERSONA VALIDATION & CALIBRATION AUDIT REPORT

**Audit Date**: August 26, 2026  
**Auditor**: Antigravity Quantitative Validation Agent  
**Branch Audited**: `main` (commit `89cf08cf`)  
**Scope**: Predictability Engine V2 (Deterministic Forecasting, Monte Carlo V1 Core, Contribution Solver, Funded-Age Solver, Node ↔ Flask Integration, Financial Outlook UX)

---

### 1. Executive Verdict

**Verdict: B — CORE ENGINE IS SOUND; CALIBRATION / UX ISSUES SHOULD BE ADDRESSED NEXT**

#### Summary Assessment:
The FINAURA Predictability Engine V2 and Monte Carlo V1 quantitative core is **mathematically sound, numerically stable, deterministic across seeds, zero-volatility compliant, and highly performant** (~184 ms median for 10,000 paths with two bisection/backward solvers).

All **25 full-stack regression suites** pass 100%. All **11 mathematical and financial comparative invariants** hold strictly across the entire parameter space. No NaN, Infinity, floating-point overflows, or fatal runtime errors occurred across 20 extreme and diverse canonical personas.

However, stress-testing against realistic human financial situations uncovered **several crucial product calibration and UX interpretation dynamics**:
1. **Nominal Flat SIP Purchasing Power Erosion**: In `NOMINAL_FLAT` mode (the default), young starters (e.g. 22-year-olds) with long accumulation horizons face extreme real purchasing power erosion from 6% inflation. Consequently, mathematical contribution recommendations require high starting nominal contributions (e.g. ₹33.8k/mo on a ₹40k salary) because the model assumes the rupee SIP is never increased over 38 years.
2. **Unconstrained Near-Retirement Recommendations**: For severely underfunded near-retirement users (e.g. Persona 8, Age 55 $\to$ 60), the contribution solver mathematically recommends ₹3,53,400/month on a ₹1,00,000 salary to reach a 75% confidence target in 5 years. This is mathematically accurate for the target but requires product-level affordability guardrails and retirement age flex options.
3. **Late-Life Funded Ages (> Age 70–80)**: For profiles with modest savings rates, `fundedAge50` or `fundedAge75` often occurs at ages 70–90+. While mathematically valid under sustained backward-scan semantics, displaying "75% Funded Probability Age: 88" requires clear UX contextualization so users do not mistake it for a practical retirement plan.

---

### 2. Repository State Audited

| Component | Path / Reference | State / Invariants Audited |
| :--- | :--- | :--- |
| **Node Orchestration** | [`PredictabilityService.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/services/PredictabilityService.js) | Pure deterministic snapshot builder, single debt count, zero DB writes |
| **Forecast Resolver** | [`forecastResolver.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/utils/forecastResolver.js) | Data quality tiers (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`), liability overhang math |
| **Financial Math** | [`financialMath.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/utils/financialMath.js) | Fisher real return, EAR/EMR compounding, SWR sizing, amortizations |
| **MC Adapter** | [`monteCarloAdapter.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/utils/monteCarloAdapter.js) | Return-derived volatility policy, SHA-256 deterministic seed, HTTP client |
| **Python Simulation** | [`monte_carlo.py`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/ml-service/monte_carlo.py) | Vectorized NumPy GBM, geometric median anchoring, nominal coordinate space |
| **Python Solvers** | [`contribution_solver.py`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/ml-service/contribution_solver.py), [`funded_age_solver.py`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/ml-service/funded_age_solver.py) | CRN bisection solver (75% target), sustained backward-scan ladder |
| **Flask API** | [`api.py`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/ml-service/api.py) | `POST /simulate` with strict JSON schema and sanitized NumPy outputs |
| **Frontend UX** | [`FinancialOutlookScreen.tsx`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/client/src/screens/FinancialOutlookScreen.tsx) | Progressive disclosure, INR formatting, target separation, low-data badges |

---

### 3. Validation Methodology

1. **Harness Execution**: Created [`test_predictability_personas.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/test_predictability_personas.js) and [`run_complete_calibration_audit.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/run_complete_calibration_audit.js) to run live end-to-end snapshots across Node $\to$ Flask $\to$ Python with 10,000 paths per run.
2. **Canonical Personas**: Evaluated 20 realistic Indian financial personas covering early-career starters, high earners, debt-laden families, near-retirees, zero-asset users, extreme parameters, and low-data profiles.
3. **Comparative Invariants**: Evaluated 11 paired sensitivity and monotonicity constraints ($A$ through $K$).
4. **Reconciliation Tests**: Executed zero-volatility ($\sigma = 0$) baseline checks against deterministic closed-form equations.
5. **Sensitivity Grids**: Conducted 5 controlled sweeps across Expected Return (4%–12%), Inflation (3%–8%), Monthly SIP (₹0–₹1L), Starting Corpus (₹0–₹1Cr), and Horizons (5–40 years).
6. **Performance Benchmarks**: Executed 10 repeated iterations of 10,000-path full simulations to record minimum, median, and maximum latencies.

---

### 4. Canonical Persona Definitions

All values denominated in Indian Rupees (INR).

| # | Persona Code & Name | Age / Ret | Monthly Income | Monthly Needs / Wants | Monthly SIP | Investable Corpus | Liabilities & Debts | Expected Return / Inf. |
| :- | :--- | :- | :- | :- | :- | :- | :- | :- |
| **1** | `P01_young_starter` | 22 / 60 | ₹40,000 | ₹20k / ₹10k | ₹5,000 | ₹50,000 | None | 8.0% / 6.0% |
| **2** | `P02_strong_young_saver` | 25 / 60 | ₹80,000 | ₹25k / ₹15k | ₹40,000 | ₹5,00,000 | None | 8.0% / 6.0% |
| **3** | `P03_high_income_lifestyle_inflation` | 32 / 60 | ₹2,50,000 | ₹1.2L / ₹80k | ₹30,000 | ₹15,00,000 | None | 8.0% / 6.0% |
| **4** | `P04_high_income_high_saver` | 32 / 60 | ₹2,50,000 | ₹50k / ₹20k | ₹1,50,000 | ₹15,00,000 | None | 8.0% / 6.0% |
| **5** | `P05_debt_heavy_household` | 35 / 60 | ₹1,50,000 | ₹40k / ₹15k | ₹20,000 | ₹10,00,000 | Home Loan EMI ₹45k (₹40L bal, 15y) | 8.0% / 6.0% |
| **6** | `P06_liability_ends_before_ret` | 40 / 60 | ₹1,20,000 | ₹45k / ₹15k | ₹25,000 | ₹20,00,000 | Auto Loan EMI ₹25k (₹10L bal, 5y) | 8.0% / 6.0% |
| **7** | `P07_liability_extends_beyond_ret`| 50 / 60 | ₹1,80,000 | ₹50k / ₹20k | ₹30,000 | ₹40,00,000 | Mortgage EMI ₹50k (₹50L bal, 20y) | 8.0% / 6.0% |
| **8** | `P08_near_ret_underfunded` | 55 / 60 | ₹1,00,000 | ₹55k / ₹25k | ₹10,000 | ₹20,00,000 | None | 8.0% / 6.0% |
| **9** | `P09_near_ret_well_funded` | 55 / 60 | ₹1,80,000 | ₹55k / ₹25k | ₹40,000 | ₹3,50,00,000 | None | 8.0% / 6.0% |
| **10**| `P10_already_fire` | 45 / 60 | ₹1,00,000 | ₹40k / ₹20k | ₹30,000 | ₹6,00,00,000 | None | 8.0% / 6.0% |
| **11**| `P11_zero_assets` | 30 / 60 | ₹75,000 | ₹35k / ₹15k | ₹15,000 | ₹0 | None | 8.0% / 6.0% |
| **12**| `P12_zero_current_investments` | 30 / 60 | ₹75,000 | ₹35k / ₹15k | ₹0 | ₹10,00,000 | None | 8.0% / 6.0% |
| **13**| `P13_very_conservative` | 30 / 60 | ₹1,00,000 | ₹35k / ₹15k | ₹25,000 | ₹10,00,000 | None | 4.0% / 6.0% |
| **14**| `P14_optimistic_return` | 30 / 60 | ₹1,00,000 | ₹35k / ₹15k | ₹25,000 | ₹10,00,000 | None | 12.0% / 6.0% |
| **15**| `P15_negative_real_return` | 30 / 60 | ₹1,00,000 | ₹35k / ₹15k | ₹25,000 | ₹10,00,000 | None | 4.0% / 7.0% |
| **16**| `P16_huge_personal_goal` | 30 / 60 | ₹1,20,000 | ₹35k / ₹15k | ₹30,000 | ₹10,00,000 | Goal: ₹10 Cr | 8.0% / 6.0% |
| **17**| `P17_personal_goal_below_fire` | 30 / 60 | ₹1,20,000 | ₹35k / ₹15k | ₹30,000 | ₹10,00,000 | Goal: ₹40 Lakhs | 8.0% / 6.0% |
| **18**| `P18_low_financial_history` | 30 / 60 | ₹80,000 | ₹35k / ₹15k (1 mo)| ₹20,000 | ₹10,00,000 | None | 8.0% / 6.0% |
| **19**| `P19_insufficient_history` | 30 / 60 | ₹80,000 | 0 history | ₹0 | ₹10,00,000 | None | 8.0% / 6.0% |
| **20**| `P20_extreme_valid_inputs` | 20 / 70 | ₹30,00,000 | ₹10L / ₹5L | ₹10,00,000 | ₹50,00,00,000 | None | 18.0% / 6.0% |

---

### 5. Persona Results

| # | Persona | Estimated FIRE Target | Deterministic Projected Corpus | P(Funded @ Ret) | p10 Corpus | p50 Median Corpus | p90 Corpus | Funded Age (50%) | Funded Age (75%) | Current SIP | Recommended SIP (75%) | Additional SIP Required | Data Quality |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Young Starter | ₹72.00 L | ₹15.98 L | **0.8%** | ₹7.97 L | ₹16.25 L | ₹34.85 L | Unreached | Unreached | ₹5,000 | ₹33,800 | +₹28,800 | HIGH |
| **2** | Strong Saver | ₹96.00 L | ₹1.21 Cr | **67.5%** | ₹62.29 L | ₹1.23 Cr | ₹2.55 Cr | Age 50y 9m | Age 66y 10m | ₹40,000 | ₹45,400 | +₹5,400 | HIGH |
| **3** | Lifestyle Infl. | ₹4.80 Cr | ₹94.89 L | **0.1%** | ₹46.54 L | ₹96.44 L | ₹2.07 Cr | Unreached | Unreached | ₹30,000 | ₹2,80,900 | +₹2,50,900 | HIGH |
| **4** | High Saver | ₹1.68 Cr | ₹3.73 Cr | **96.6%** | ₹2.10 Cr | ₹3.81 Cr | ₹7.10 Cr | Age 41y 11m | Age 44y 8m | ₹1,50,000 | ₹1,50,000 | ₹0 | HIGH |
| **5** | Debt-Heavy | ₹1.32 Cr | ₹58.30 L | **4.7%** | ₹29.74 L | ₹59.57 L | ₹1.23 Cr | Unreached | Unreached | ₹20,000 | ₹74,000 | +₹54,000 | HIGH |
| **6** | Pre-Ret Debt | ₹1.44 Cr | ₹73.40 L | **6.3%** | ₹38.74 L | ₹73.61 L | ₹1.47 Cr | Age 87y 8m | Unreached | ₹25,000 | ₹88,000 | +₹63,000 | HIGH |
| **7** | Post-Ret Debt | ₹1.91 Cr | ₹78.40 L | **0.4%** | ₹50.77 L | ₹78.93 L | ₹1.30 Cr | Age 92 | Unreached | ₹30,000 | ₹1,75,900 | +₹1,45,900 | HIGH |
| **8** | Near-Ret Underf.| ₹1.92 Cr | ₹27.40 L | **0.0%** | ₹20.89 L | ₹27.27 L | ₹36.31 L | Unreached | Unreached | ₹10,000 | ₹3,53,400 | +₹3,43,400 | HIGH |
| **9** | Near-Ret Funded | ₹1.92 Cr | ₹4.06 Cr | **99.8%** | ₹3.11 Cr | ₹4.04 Cr | ₹5.33 Cr | Age 55 | Age 55 | ₹40,000 | ₹40,000 | ₹0 | HIGH |
| **10**| Already FIRE | ₹1.44 Cr | ₹8.36 Cr | **100.0%**| ₹5.06 Cr | ₹8.33 Cr | ₹14.07 Cr | Age 45 | Age 45 | ₹30,000 | ₹30,000 | ₹0 | HIGH |
| **11**| Zero Assets | ₹1.20 Cr | ₹36.80 L | **1.0%** | ₹17.65 L | ₹37.66 L | ₹84.14 L | Unreached | Unreached | ₹15,000 | ₹65,600 | +₹50,600 | HIGH |
| **12**| Zero Invest. | ₹1.20 Cr | ₹17.50 L | **0.1%** | ₹8.05 L | ₹17.63 L | ₹39.81 L | Unreached | Unreached | ₹0 | ₹59,500 | +₹59,500 | HIGH |
| **13**| Very Conserv. | ₹1.20 Cr | ₹35.50 L | **0.0%** | ₹24.08 L | ₹35.61 L | ₹53.86 L | Unreached | Unreached | ₹25,000 | ₹1,11,300 | +₹86,300 | HIGH |
| **14**| Optimistic Ret | ₹1.20 Cr | ₹1.85 Cr | **70.5%** | ₹77.83 L | ₹1.94 Cr | ₹5.03 Cr | Age 52y 1m | Age 63y 1m | ₹25,000 | ₹29,200 | +₹4,200 | HIGH |
| **15**| Negative Real | ₹1.20 Cr | ₹26.80 L | **0.0%** | ₹18.66 L | ₹26.91 L | ₹39.83 L | Unreached | Unreached | ₹25,000 | ₹1,48,000 | +₹1,23,000 | HIGH |
| **16**| Huge Goal | ₹1.20 Cr | ₹91.10 L | **30.4%** | ₹46.52 L | ₹93.18 L | ₹1.91 Cr | Age 70y 10m | Unreached | ₹30,000 | ₹59,000 | +₹29,000 | HIGH |
| **17**| Low Goal | ₹1.20 Cr | ₹91.10 L | **31.0%** | ₹46.42 L | ₹93.04 L | ₹1.91 Cr | Age 71y 2m | Unreached | ₹30,000 | ₹59,500 | +₹29,500 | HIGH |
| **18**| Low History | ₹1.20 Cr | ₹66.60 L | **13.9%** | ₹33.72 L | ₹67.67 L | ₹1.40 Cr | Age 86y 1m | Unreached | ₹20,000 | ₹59,500 | +₹39,500 | LOW |
| **19**| Insufficient | N/A | N/A | **N/A** | N/A | N/A | N/A | N/A | N/A | ₹0 | N/A | N/A | INSUFFICIENT|
| **20**| Extreme Valid | ₹36.00 Cr| ₹1,219.5 Cr| **100.0%**| ₹417.8 Cr| ₹1,238.4 Cr| ₹3,767.1 Cr| Age 20 | Age 20 | ₹10,00,000 | ₹10,00,000 | ₹0 | HIGH |

---

### 6. Comparative Invariants

All 11 comparative invariants passed with 100% compliance:

```
================================================================================
  COMPARATIVE INVARIANTS AUDIT
================================================================================
 1. [PASS] Invariant A: Starting Corpus Monotonicity (₹5L vs ₹20L)
           -> val1: 15.8% | val2: 36.1%
 2. [PASS] Invariant B: Contribution Monotonicity (₹10k/mo vs ₹50k/mo)
           -> val1: 3.3% | val2: 63.8%
 3. [PASS] Invariant C: FIRE Target Monotonicity (Target ₹1.2Cr vs ₹2.4Cr)
           -> val1: 22.6% | val2: 0.8%
 4. [PASS] Invariant D: Spending vs Target Monotonicity (₹50k spend vs ₹100k spend)
           -> val1: ₹1,20,00,000 | val2: ₹2,40,00,000
 5. [PASS] Invariant E: Lower Spending Outlook Improvement
           -> val1: 22.6% | val2: 0.8%
 6. [PASS] Invariant F: Debt Overhang at Retirement (Pre-ret vs Post-ret)
           -> val1: Overhang: ₹0 | val2: Overhang: ₹7,06,204
 7. [PASS] Invariant G: Accumulation Horizon (10 yrs vs 30 yrs)
           -> val1: 0.0% | val2: 22.6%
 8. [PASS] Invariant H: Estimated FIRE Independence from Personal Goal (₹50L vs ₹5Cr)
           -> val1: ₹1,20,00,000 | val2: ₹1,20,00,000
 9. [PASS] Invariant I: Personal Goal Probability Sensitivity (Goal ₹50L vs ₹5Cr)
           -> val1: 89.2% | val2: 0.0%
10. [PASS] Invariant J: Deterministic Seed & Output Reproducibility
           -> val1: Seed: 198943196, P: 22.6% | val2: Seed: 198943196, P: 22.6%
11. [PASS] Invariant K: Seed Sensitivity to Return Rate (8% vs 9%)
           -> val1: Seed 8%: 198943196 | val2: Seed 9%: 1461937512
================================================================================
```

---

### 7. Contribution Solver Findings

The contribution solver operates via Common Random Numbers (CRN) bisection against the 75% target probability threshold.

#### Quantitative Properties Verified:
- **Monotonicity Under CRN**: Using identical $Z$-shocks across candidate bisections guarantees $P(\text{Funded} \mid C)$ is strictly non-decreasing with $C$.
- **Short-Circuit Invariant**: When $P(\text{current}) \ge 75\%$, the solver instantly returns $\Delta C = 0$, recommended $= C_{\text{current}}$, and iterations $= 0$ (verified in Personas 4, 9, 10, 20).
- **Rounding Up**: Raw bisection results are strictly rounded UP to the nearest ₹100 step and verified via post-bisection execution.
- **Dynamic Upper Bracket**: Scales geometrically ($2\times$) up to ₹1,00,00,00,000 ceiling.

#### Calibration & Product Insights:
1. **Nominal Flat SIP Sizing (Persona 1)**: For a 22-year-old starter, the solver recommends ₹33,800/mo. To a user earning ₹40,000/mo, this looks like an impossible 84.5% savings rate. In reality, a flat ₹33.8k rupee SIP is needed if the user *never increases their savings for 38 years* while facing 6% inflation. In `REAL_CONSTANT` mode (inflation-escalating SIP), the required contribution is only **₹8,800/mo** in today's rupees.
2. **Short Horizon Blowup (Persona 8)**: For a 55-year-old retiring at 60 with a ₹1.65Cr shortfall, the required SIP is **₹3,53,400/month** on a ₹1,00,000 salary.
   - *Verdict*: Mathematically correct. Product recommendation should introduce **affordability contextualization** or **retirement age delay suggestions** rather than simply presenting a 3.5× income SIP.

---

### 8. Funded-Age Findings

The funded-age solver implements sustained backward-scan semantics ($t_{\text{funded}} = \min \{ t \mid \min_{s \ge t} P_s \ge \text{threshold} \}$).

#### Quantitative Properties Verified:
- **Monotonicity**: In 100% of tested profiles where both were reached, $\text{fundedAge50} \le \text{fundedAge75}$.
- **Sustained Scan vs Naive First Touch**: Does not trigger premature ages if market volatility or nominal flat contribution erosion causes the probability to dip later in the horizon.
- **$t=0$ Sustainable Funding**: For Personas 9, 10, and 20, both 50% and 75% funded ages correctly return current age (e.g. Age 45 for Persona 10, Age 55 for Persona 9, Age 20 for Persona 20).
- **Unreached Safety**: Returns `{ reached: false, ageYears: null, monthsFromNow: null }` cleanly without throwing exceptions.

#### Calibration & Product Insights:
- **Late-Life Funded Ages**: In Persona 6, `fundedAge50` is achieved at **Age 87y 8m**. In Persona 7, it is achieved at **Age 92**. In Persona 16, it is achieved at **Age 70y 10m**.
- *UX Recommendation*: When a funded age exceeds standard life expectancy (e.g. $> 75$ or $> 80$), the UI should clearly state: *"Target funded likelihood reached past standard retirement horizon"* rather than treating Age 88 as a standard retirement date.

---

### 9. Distribution Findings

Across all 20 personas:
- **Range Invariants**: $0 \le P \le 1$ holds universally.
- **Percentile Invariants**: $p_{10} \le p_{25} \le p_{50} \le p_{75} \le p_{90}$ holds without violation.
- **Corpus Values**: All corpus percentiles $\ge 0$.

#### Percentile Spread Ratios ($p_{90} / p_{10}$):
| Persona | Horizon | $p_{10}$ | $p_{50}$ (Median) | $p_{90}$ | Spread Ratio ($p_{90}/p_{10}$) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P01 (Young Starter)** | 38 yrs | ₹7.97 L | ₹16.25 L | ₹34.85 L | **4.37×** |
| **P02 (Strong Saver)** | 35 yrs | ₹62.29 L | ₹1.23 Cr | ₹2.55 Cr | **4.09×** |
| **P08 (Near Ret Underfunded)**| 5 yrs | ₹20.89 L | ₹27.27 L | ₹36.31 L | **1.74×** |
| **P14 (Optimistic 12% Ret)** | 30 yrs | ₹77.83 L | ₹1.94 Cr | ₹5.03 Cr | **6.46×** |
| **P20 (Extreme 18% Ret)** | 50 yrs | ₹417.8 Cr | ₹1,238.4 Cr | ₹3,767.1 Cr| **9.02×** |

- **Observation**: Over long horizons (30–50 years) and higher return/volatility assumptions, compounding dispersion naturally widens the $p_{90}/p_{10}$ ratio to 4×–9×. Over short horizons (5 years), the distribution remains tight (1.74×). This behavior is mathematically standard for geometric Brownian motion.

---

### 10. Deterministic vs Monte Carlo Reconciliation

#### Zero-Volatility Parity ($\sigma = 0$):
Zero-volatility simulations were executed against the deterministic Base scenario formulas for 5 representative personas:

| Persona | Closed-Form Deterministic Projected Corpus | Monte Carlo $\sigma=0$ Central Path | Monte Carlo $\sigma=0$ Median ($p_{50}$) | Absolute Discrepancy |
| :--- | :--- | :--- | :--- | :--- |
| **P01 (Young Starter)** | ₹15,97,965.68 | ₹15,97,965.68 | ₹15,97,965.68 | **₹0.00** |
| **P02 (Strong Saver)** | ₹1,21,12,194.11 | ₹1,21,12,194.11 | ₹1,21,12,194.11 | **₹0.00** |
| **P04 (High Saver)** | ₹3,73,20,582.33 | ₹3,73,20,582.33 | ₹3,73,20,582.33 | **₹0.00** |
| **P08 (Near Ret Underfunded)** | ₹27,39,836.93 | ₹27,39,836.93 | ₹27,39,836.93 | **₹0.00** |
| **P09 (Near Ret Well Funded)** | ₹4,06,11,634.33 | ₹4,06,11,634.33 | ₹4,06,11,634.33 | **₹0.00** |

**Conclusion**: Under $\sigma = 0$, Monte Carlo matches the closed-form deterministic Base scenario with **exact rupee parity (delta = ₹0.00)**.

#### Production Volatility vs Deterministic Base:
Under production-derived volatility ($\sigma = 12\%$), median empirical outcomes ($p_{50}$) closely track the deterministic central path with minor finite-sample variance ($\le 1.8\%$ for 10,000 paths), confirming exact median-anchored lognormal parametrization.

---

### 11. Sensitivity Analysis

Evaluated on a representative middle-income baseline: Age 30, Ret 60 (30-yr horizon), Starting Corpus ₹10L, Monthly Spending ₹50k (Needs ₹35k, Wants ₹15k $\to$ FIRE Target ₹1.20Cr), Monthly SIP ₹25k.

#### Sweep 1: Expected Return Rate (4% to 12%)
| Expected Return | Volatility Derived | Real Return | P(Funded @ 60) | Median Corpus ($p_{50}$) | Funded Age (50%) | Funded Age (75%) | Recommended SIP (75%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **4.0%** | 6.0% (Clamped) | -1.89% | **0.0%** | ₹35.61 L | Unreached | Unreached | ₹1,11,300 |
| **6.0%** | 8.0% | 0.00% | **0.9%** | ₹53.09 L | Unreached | Unreached | ₹80,000 |
| **8.0%** | 12.0% | +1.89% | **22.6%** | ₹80.79 L | Age 77y 4m | Unreached | ₹59,500 |
| **10.0%** | 16.0% | +3.77% | **51.7%** | ₹1.24 Cr | Age 59y 4m | Age 74y 3m | ₹43,300 |
| **12.0%** | 20.0% | +5.66% | **70.5%** | ₹1.94 Cr | Age 52y 1m | Age 63y 1m | ₹29,200 |

- *Observation*: Monotonic improvement in probability and median corpus as expected return rises. The widening volatility does not overpower positive return drift.

#### Sweep 2: Expected Inflation Rate (3% to 8%)
| Expected Inflation | Real Return | P(Funded @ 60) | Median Corpus ($p_{50}$) | Funded Age (50%) | Funded Age (75%) | Recommended SIP (75%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3.0%** | +4.85% | **82.1%** | ₹1.90 Cr | Age 51y 11m | Age 57y 7m | ₹25,000 |
| **4.0%** | +3.85% | **63.0%** | ₹1.42 Cr | Age 56y 4m | Age 64y 8m | ₹31,100 |
| **5.0%** | +2.86% | **41.0%** | ₹1.07 Cr | Age 63y 8m | Age 78y 4m | ₹43,300 |
| **6.0%** | +1.89% | **22.6%** | ₹80.79 L | Age 77y 4m | Unreached | ₹59,500 |
| **7.0%** | +0.93% | **9.7%** | ₹60.61 L | Unreached | Unreached | ₹80,700 |
| **8.0%** | 0.00% | **3.5%** | ₹45.80 L | Unreached | Unreached | ₹1,09,000 |

- *Observation*: Higher inflation severely suppresses funding probability in `NOMINAL_FLAT` mode due to fixed rupee contribution depreciation.

#### Sweep 3: Monthly Contribution (₹0 to ₹1,00,000)
| Monthly SIP | P(Funded @ 60) | Median Corpus ($p_{50}$) | Funded Age (50%) | Funded Age (75%) | Recommended SIP (75%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **₹0** | **0.1%** | ₹17.63 L | Unreached | Unreached | ₹59,500 |
| **₹10,000** | **3.3%** | ₹42.59 L | Unreached | Unreached | ₹59,300 |
| **₹25,000** | **22.6%** | ₹80.79 L | Age 77y 4m | Unreached | ₹59,500 |
| **₹50,000** | **63.8%** | ₹1.42 Cr | Age 53y 11m | Age 69y 1m | ₹59,200 |
| **₹75,000** | **87.1%** | ₹2.06 Cr | Age 45y 1m | Age 51y 3m | ₹75,000 |
| **₹1,00,000**| **95.3%** | ₹2.67 Cr | Age 40y 9m | Age 43y 10m | ₹1,00,000 |

#### Sweep 4: Starting Investable Corpus (₹0 to ₹1 Crore)
| Starting Corpus | P(Funded @ 60) | Median Corpus ($p_{50}$) | Funded Age (50%) | Funded Age (75%) | Recommended SIP (75%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **₹0** | **9.2%** | ₹62.84 L | Age 89y 7m | Unreached | ₹65,600 |
| **₹5,00,000** | **15.8%** | ₹71.21 L | Age 84 | Unreached | ₹62,400 |
| **₹10,00,000**| **22.6%** | ₹80.79 L | Age 77y 4m | Unreached | ₹59,500 |
| **₹25,00,000**| **42.0%** | ₹1.08 Cr | Age 64y 6m | Unreached | ₹49,200 |
| **₹50,00,000**| **65.6%** | ₹1.50 Cr | Age 51 | Age 70y 10m | ₹34,300 |
| **₹1,00,00,000**|**87.8%** | ₹2.38 Cr | Age 34y 3m | Age 42y 2m | ₹25,000 |

#### Sweep 5: Accumulation Horizon (5 to 40 Years)
| Horizon | P(Funded @ 60) | Median Corpus ($p_{50}$) | Funded Age (50%) | Funded Age (75%) | Recommended SIP (75%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **5 yrs (Age 55 $\to$ 60)** | **0.0%** | ₹24.73 L | Age 102y 6m | Unreached | ₹2,24,900 |
| **10 yrs (Age 50 $\to$ 60)**| **0.0%** | ₹37.32 L | Age 98y 2m | Unreached | ₹1,28,400 |
| **20 yrs (Age 40 $\to$ 60)**| **4.2%** | ₹59.65 L | Age 88y 8m | Unreached | ₹78,100 |
| **30 yrs (Age 30 $\to$ 60)**| **22.6%** | ₹80.79 L | Age 77y 4m | Unreached | ₹59,500 |
| **40 yrs (Age 20 $\to$ 60)**| **39.6%** | ₹1.01 Cr | Age 68y 2m | Unreached | ₹48,400 |

---

### 12. Volatility Policy Calibration Review

Audit of formula: $\sigma = \text{clamp}(-0.04 + 2.0 \cdot r_{\text{nominal}}, 0.06, 0.22)$

| Expected Return Rate ($r$) | Raw Formula Value | Effective Volatility ($\sigma$) | Policy Region |
| :--- | :--- | :--- | :--- |
| **0.0%** | -4.0% | **6.0%** | Clamped Minimum (Floor) |
| **2.0%** | 0.0% | **6.0%** | Clamped Minimum (Floor) |
| **4.0%** | 4.0% | **6.0%** | Clamped Minimum (Floor) |
| **5.0%** | 6.0% | **6.0%** | Linear Boundary |
| **6.0%** | 8.0% | **8.0%** | Linear Region |
| **8.0% (Default)** | 12.0% | **12.0%** | Linear Region |
| **10.0%** | 16.0% | **16.0%** | Linear Region |
| **12.0%** | 20.0% | **20.0%** | Linear Region |
| **13.0%** | 22.0% | **22.0%** | Linear Boundary |
| **15.0%** | 26.0% | **22.0%** | Clamped Maximum (Ceiling) |
| **18.0%** | 32.0% | **22.0%** | Clamped Maximum (Ceiling) |
| **20.0%** | 36.0% | **22.0%** | Clamped Maximum (Ceiling) |

#### Calibration Findings:
1. **Floor (6%) Behavior**: For conservative returns ($0\% \le r \le 4\%$), the 6% floor ensures the model maintains a sensible lower bound on bond/fixed-income volatility.
2. **Ceiling (22%) Behavior**: For high returns ($r \ge 13\%$), clamping prevents unbounded variance while modeling heavy equity exposure.
3. **Monotonicity**: Increasing return increases probability across all test cases. There is no region where higher return reduces funding probability due to excess variance.
4. **Estimated Risk Notice**: The `PORTFOLIO_RISK_ESTIMATED` warning is systematically attached to all responses, ensuring honest disclosure that volatility is return-derived rather than asset-allocated.

---

### 13. Liability Behavior

1. **Pre-Retirement Liability Maturity (Persona 6)**:
   - Car loan matures at month 60 (well before month 240 retirement).
   - Remaining balance at retirement $= 0$.
   - Liability overhang correctly computed as **₹0**.
   - Current debt service (₹25k/mo) is properly accounted for in cash flows without inflating the FIRE corpus.
2. **Post-Retirement Liability Overhang (Persona 7)**:
   - 20-year mortgage (240 months) continues 10 years past retirement (120 months).
   - Amortization formula accurately projects balance at $T=120$ as ₹46,62,040.
   - Overhang is added to the lifestyle FIRE corpus (₹1.44Cr $\to$ ₹1.906Cr).
   - Debt service is not double counted as ongoing consumption.

---

### 14. Low-Data Behavior

1. **Low Data Quality (Persona 18 — 1 Month History)**:
   - `forecastStatus.dataQuality` is resolved as `LOW`.
   - Monte Carlo runs successfully, but attaches `MONTE_CARLO_DATA_QUALITY_LOW` explanation fact.
   - Frontend renders the yellow warning banner: *"This forecast is based on limited financial history and may change as FINAURA learns more..."*
2. **Insufficient Data (Persona 19 — 0 Months History)**:
   - `forecastStatus.dataQuality` is resolved as `INSUFFICIENT`.
   - `forecastStatus.available` is set to `false`.
   - `PredictabilityService` strictly gates Monte Carlo execution (`attachMonteCarloSimulation` returns `reason: 'FORECAST_INPUTS_UNAVAILABLE'`).
   - Python `/simulate` is not invoked.
   - Frontend safely falls back to informational prompt without throwing rendering errors.

---

### 15. Personal Goal vs Estimated FIRE Requirement

1. **Huge Personal Goal (Persona 16 — ₹10 Cr Goal vs ₹1.2 Cr Requirement)**:
   - Estimated FIRE target remains unaffected at ₹1.20 Cr ($P = 30.4\%$).
   - User Goal is tracked in parallel at ₹10.00 Cr ($P = 0.0\%$).
   - Frontend renders both in side-by-side comparison boxes with distinct badges.
2. **Under-Targeted Goal (Persona 17 — ₹40 L Goal vs ₹1.2 Cr Requirement)**:
   - Estimated FIRE target remains ₹1.20 Cr ($P = 31.0\%$).
   - User Goal of ₹40 Lakhs shows $P = 89.2\%$.
   - Separation prevents misleading users into believing their smaller personal goal satisfies full retirement lifestyle needs.

---

### 16. UX / Product Interpretation Findings

| Category | Persona / Area | Issue / Observation | Product UX Recommendation |
| :--- | :--- | :--- | :--- |
| **PRODUCT UX** | Persona 1 (Young Starter) | Flat nominal SIP (₹33.8k/mo on ₹40k salary) looks unaffordable over 38-year horizon. | Introduce Step-Up SIP or `REAL_CONSTANT` mode in UI to show inflation-adjusted savings path. |
| **PRODUCT UX** | Persona 8 (Near-Ret Underfunded)| Recommends ₹3.53L/mo on ₹1.0L salary (3.5× monthly income). | Add affordability guardrail badge: *"Requires significant capital injection or delaying retirement by N years."* |
| **PRODUCT UX** | Persona 6, 7, 16, 18 | `fundedAge50` or `fundedAge75` occurring at Age 85–95. | Format ages $> 75$ with disclaimer: *"Target probability reached beyond standard horizon."* |
| **DATA QUALITY**| Persona 18 | Low history badge appropriately alerts user. | Keep active. Ensures trust during early onboarding. |
| **EXPECTED BEHAVIOR**| Persona 10, 20 | Already funded users show 100% chance and Age 45 / 20. | Cleanly displays "Currently Funded" in green banner. |

---

### 17. Performance Results

Benchmarked across 10 repeated end-to-end executions of 10,000 simulation paths with all solvers enabled:

| Metric | Measured Latency |
| :--- | :--- |
| **Minimum Latency** | 182.5 ms |
| **Median Latency** | **184.3 ms** |
| **Average Latency** | 185.5 ms |
| **Maximum Latency** | 198.7 ms |
| **Simulation Core Only (Python)** | ~30.0 ms |
| **Contribution Bisection Solver** | ~45.0 ms |
| **Funded-Age Backward-Scan Solver** | ~89.0 ms |
| **Flask HTTP Network + Serialization Overhead** | ~20.0 ms |

**Result**: Highly responsive and well within the 5,000 ms API timeout budget.

---

### 18. Regression Results

All regression suites executed locally and verified:

```
================================================================================
  FINAURA FULL-STACK REGRESSION AUDIT RESULTS
================================================================================
  1.  server/test_financial_math.js                                  -> PASSED (100%)
  2.  server/test_predictability_foundation.js                       -> PASSED (100%)
  3.  server/test_predictability_scenarios.js                        -> PASSED (100%)
  4.  server/test_predictability_service.js                          -> PASSED (100%)
  5.  server/test_predictability_independent_validation.js           -> PASSED (100%)
  6.  server/test_predictability_prework.js                          -> PASSED (100%)
  7.  server/test_predictability_monte_carlo_integration.js          -> PASSED (28/28 tests)
  8.  server/test_predictability_monte_carlo_live.js                 -> PASSED (100%)
  9.  server/test_income_analytics.js                                -> PASSED (100%)
  10. server/test_liability_feature.js                               -> PASSED (100%)
  11. server/test_liability_payment_history.js                       -> PASSED (100%)
  12. server/test_liability_manual_payment.js                        -> PASSED (100%)
  13. server/test_manual_liability_linking.js                        -> PASSED (100%)
  14. server/test_liability_concurrency.js                           -> PASSED (100%)
  15. server/test_transaction_integrity.js                           -> PASSED (27/27 tests)
  16. server/test_classification_fmi_pipeline.js                     -> PASSED (41/41 tests)
  17. server/test_v2_minilm_integration.js                          -> PASSED (14/14 tests)
  18. ml-service/test_monte_carlo.py                                 -> PASSED (17/17 tests)
  19. ml-service/test_contribution_solver.py                         -> PASSED (16/16 tests)
  20. ml-service/test_funded_age_solver.py                           -> PASSED (17/17 tests)
  21. ml-service/test_monte_carlo_api.py                             -> PASSED (18/18 tests)
  22. ml-service/test_hybrid_classifier.py                           -> PASSED (5/5 tests)
  23. client/test_financial_outlook_ux.js                            -> PASSED (12/12 tests)
  24. client/ TypeScript Validation (tsc --noEmit)                   -> PASSED (0 errors)
  25. server/test_predictability_personas.js                         -> PASSED (20/20 personas)
================================================================================
  TOTAL REGRESSION SUITES PASSED: 25 / 25 (100%)
================================================================================
```

---

### 19. Bugs Found

Zero critical mathematical or software bugs were found.

| ID | Severity | Description | Status |
| :--- | :--- | :--- | :--- |
| **None** | — | No mathematical errors, division-by-zero, NaN leaks, or integration failures detected. | **CLEAN** |

---

### 20. Calibration Questions

Ranked priority list for future development phases:

#### [P0] Step-Up / Escalating Contribution Support in UI (`REAL_CONSTANT` or Step-Up SIP)
- **Rationale**: `NOMINAL_FLAT` is mathematically rigorous for fixed rupee SIPs, but penalizes long horizons heavily due to inflation. Exposing Step-Up SIP (e.g. +5% or +10% annual increase) or `REAL_CONSTANT` in onboarding/outlook will yield much more actionable recommendations for young starters.

#### [P1] Affordability Guardrails for Contribution Recommendations
- **Rationale**: When $\Delta C > \text{Monthly Income}$, the UI should flag this as a stretch target and pair it with retirement age deferral scenarios (e.g., *"Delaying retirement to age 63 reduces required SIP to ₹65k/mo"*).

#### [P2] Upper-Bound Guardrails for Funded Ages
- **Rationale**: When `fundedAge50` or `fundedAge75` exceeds Age 75, display a gentler status label (*"Horizon Exceeded"*) to avoid confusing users with retirement projections at Age 88 or 92.

#### [P3] Portfolio Asset Allocation Risk Modeling (Post-V1)
- **Rationale**: Transitioning from return-derived volatility $\sigma(r)$ to asset-allocation-weighted volatility once portfolio breakdown data (Equity % vs Debt % vs Gold %) is collected from user assets.

---

### 21. Recommended Next Development Phase

**Recommendation: UX Guardrails & Step-Up Contribution Modeling**

The next phase should focus on:
1. **Interactive Step-Up SIP Toggle**: Enabling users to toggle between fixed nominal SIP and annual step-up SIP in FinancialOutlookScreen.
2. **Affordability Guardrails**: Contextualizing contribution recommendations against user income.
3. **Retirement Delay Scenarios**: Showing alternative retirement ages when current targets require impossible savings rates.

---

### 22. Files Created / Modified

- [`server/test_predictability_personas.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/test_predictability_personas.js) — Canonical persona test harness
- [`server/run_complete_calibration_audit.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/run_complete_calibration_audit.js) — Master audit runner
- [`server/print_audit_summary.js`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/print_audit_summary.js) — Summary generation script
- [`server/scratch_audit_results.json`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/server/scratch_audit_results.json) — Full structured numerical results
- [`predictability_validation_report.md`](file:///Users/parthspalav/Documents/College/Projects/LY%20Project/LYProj_C34/predictability_validation_report.md) — Comprehensive validation report

---

### 23. Git Status

All audit scripts and reports have been generated and verified without staging, committing, or pushing:

```
?? predictability_validation_report.md
?? server/print_audit_summary.js
?? server/run_complete_calibration_audit.js
?? server/scratch_audit_results.json
?? server/test_predictability_personas.js
```

---

### FINAL VERDICT

**B — CORE ENGINE IS SOUND; CALIBRATION / UX ISSUES SHOULD BE ADDRESSED NEXT**
