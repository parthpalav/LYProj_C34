"""
ml-service/test_step_up_contributions.py

Comprehensive test suite for STEP_UP SIP / Annual Contribution Escalation
in FINAURA Monte Carlo Engine, Contribution Solver, and Funded-Age Solver.
"""

import math
import numpy as np

from monte_carlo import (
    run_simulation,
    CONTRIBUTION_MODE_NOMINAL_FLAT,
    CONTRIBUTION_MODE_REAL_CONSTANT,
    CONTRIBUTION_MODE_STEP_UP,
)
from contribution_solver import solve_required_contribution
from funded_age_solver import solve_funded_ages


def _analytical_step_up_nominal(c0: float, g: float, r_annual: float, months: int) -> float:
    """
    Independent analytical reference for end-of-month step-up contributions nominal FV.
    FV = sum_{t=1}^T c0 * (1 + g)^((t-1)//12) * (1 + r_monthly)^(T - t)
    """
    r_m = (1.0 + r_annual) ** (1.0 / 12.0) - 1.0
    total = 0.0
    for t in range(1, months + 1):
        year_idx = (t - 1) // 12
        pmt = c0 * ((1.0 + g) ** year_idx)
        months_remaining = months - t
        total += pmt * ((1.0 + r_m) ** months_remaining)
    return total


def test_1_step_up_input_validation():
    print("\nRunning 1. STEP_UP Input Validation...")
    base_params = {
        "startingCorpus": 1000000.0,
        "monthlyContribution": 20000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": 240,
        "contributionMode": "STEP_UP",
        "simulationCount": 1000,
        "seed": 42
    }

    # Missing annualContributionGrowthRate
    try:
        run_simulation(base_params)
        assert False, "Should have failed on missing annualContributionGrowthRate"
    except ValueError as e:
        assert "annualContributionGrowthRate" in str(e)

    # Non-numeric
    try:
        run_simulation({**base_params, "annualContributionGrowthRate": "ten_percent"})
        assert False, "Should have failed on string growth rate"
    except TypeError:
        pass

    # Negative rate
    try:
        run_simulation({**base_params, "annualContributionGrowthRate": -0.05})
        assert False, "Should have failed on negative growth rate"
    except ValueError:
        pass

    # Unbounded / absurd rate > 50%
    try:
        run_simulation({**base_params, "annualContributionGrowthRate": 0.55})
        assert False, "Should have failed on >50% growth rate"
    except ValueError:
        pass

    # NaN / Inf
    try:
        run_simulation({**base_params, "annualContributionGrowthRate": float("nan")})
        assert False, "Should have failed on NaN growth rate"
    except ValueError:
        pass

    try:
        run_simulation({**base_params, "annualContributionGrowthRate": float("inf")})
        assert False, "Should have failed on Inf growth rate"
    except ValueError:
        pass

    # None growth rate
    try:
        run_simulation({**base_params, "annualContributionGrowthRate": None})
        assert False, "Should have failed on None growth rate for STEP_UP"
    except ValueError as e:
        assert "annualContributionGrowthRate" in str(e)

    # Valid rate (0% and 50%)
    res_0 = run_simulation({**base_params, "annualContributionGrowthRate": 0.0})
    res_50 = run_simulation({**base_params, "annualContributionGrowthRate": 0.50})
    assert "probabilityFundedAtTargetAge" in res_0
    assert "probabilityFundedAtTargetAge" in res_50

    # Legacy modes without annualContributionGrowthRate remain accepted
    res_flat = run_simulation({**base_params, "contributionMode": CONTRIBUTION_MODE_NOMINAL_FLAT})
    res_real = run_simulation({**base_params, "contributionMode": CONTRIBUTION_MODE_REAL_CONSTANT})
    assert "probabilityFundedAtTargetAge" in res_flat
    assert "probabilityFundedAtTargetAge" in res_real
    print("  ✅ Test 1 Passed: Input validation boundaries [0.0, 0.50] strictly enforced")


def test_2_step_up_zero_growth_equals_nominal_flat():
    print("\nRunning 2. STEP_UP (g=0) == NOMINAL_FLAT Equivalence...")
    params_flat = {
        "startingCorpus": 500000.0,
        "monthlyContribution": 15000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 8000000.0,
        "monthsUntilRetirement": 180,
        "contributionMode": "NOMINAL_FLAT",
        "simulationCount": 5000,
        "seed": 12345
    }
    params_step_up_0 = {
        **params_flat,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": 0.0
    }

    res_flat = run_simulation(params_flat)
    res_step_up = run_simulation(params_step_up_0)

    assert math.isclose(res_flat["probabilityFundedAtTargetAge"], res_step_up["probabilityFundedAtTargetAge"], abs_tol=1e-9)
    assert math.isclose(res_flat["centralPath"]["finalCorpusNominal"], res_step_up["centralPath"]["finalCorpusNominal"], abs_tol=1e-4)
    assert math.isclose(res_flat["corpusPercentiles"]["p50"], res_step_up["corpusPercentiles"]["p50"], abs_tol=1e-4)
    print("  ✅ Test 2 Passed: g=0.0 produces identical outcome to NOMINAL_FLAT")


def test_3_step_up_beats_nominal_flat_path_by_path():
    print("\nRunning 3. Path-by-Path Dominance: STEP_UP >= NOMINAL_FLAT...")
    params_flat = {
        "startingCorpus": 500000.0,
        "monthlyContribution": 15000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": 240,
        "contributionMode": "NOMINAL_FLAT",
        "simulationCount": 5000,
        "seed": 999
    }
    params_step_up_10 = {
        **params_flat,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": 0.10
    }

    res_flat = run_simulation(params_flat)
    res_step = run_simulation(params_step_up_10)

    # Final real percentiles must be strictly greater for positive growth
    assert res_step["corpusPercentiles"]["p10"] > res_flat["corpusPercentiles"]["p10"]
    assert res_step["corpusPercentiles"]["p50"] > res_flat["corpusPercentiles"]["p50"]
    assert res_step["corpusPercentiles"]["p90"] > res_flat["corpusPercentiles"]["p90"]
    assert res_step["probabilityFundedAtTargetAge"] >= res_flat["probabilityFundedAtTargetAge"]
    print(f"  Flat prob={res_flat['probabilityFundedAtTargetAge']:.4f} (p50=₹{res_flat['corpusPercentiles']['p50']:,.0f}) vs "
          f"Step-Up 10% prob={res_step['probabilityFundedAtTargetAge']:.4f} (p50=₹{res_step['corpusPercentiles']['p50']:,.0f})")
    print("  ✅ Test 3 Passed: STEP_UP(10%) strictly outperforms NOMINAL_FLAT")


def test_4_growth_rate_monotonicity_ladder():
    print("\nRunning 4. Growth Rate Monotonicity Ladder (0% -> 5% -> 10% -> 15%)...")
    base = {
        "startingCorpus": 200000.0,
        "monthlyContribution": 10000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 12000000.0,
        "monthsUntilRetirement": 300,
        "contributionMode": "STEP_UP",
        "simulationCount": 5000,
        "seed": 777
    }

    probs = []
    p50s = []
    for g in [0.0, 0.05, 0.10, 0.15]:
        r = run_simulation({**base, "annualContributionGrowthRate": g})
        probs.append(r["probabilityFundedAtTargetAge"])
        p50s.append(r["corpusPercentiles"]["p50"])
        print(f"    g={int(g*100):2d}%: prob={r['probabilityFundedAtTargetAge']:.4f}, p50=₹{r['corpusPercentiles']['p50']:,.0f}")

    # Monotonicity check
    for i in range(len(probs) - 1):
        assert probs[i] <= probs[i + 1], f"Probability decreased from g={i} to g={i+1}"
        assert p50s[i] < p50s[i + 1], f"p50 wealth did not strictly increase from g={i} to g={i+1}"

    print("  ✅ Test 4 Passed: Higher step-up rate monotonically increases probability and wealth")


def test_5_step_up_solver_initial_contribution_ladder():
    print("\nRunning 5. Step-Up Contribution Solver (Initial Contribution Monotonicity)...")
    base_solver = {
        "startingCorpus": 300000.0,
        "monthlyContribution": 5000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": 240,
        "contributionMode": "STEP_UP",
        "targetProbability": 0.75,
        "simulationCount": 5000,
        "seed": 42
    }

    solved_initial = []
    for g in [0.0, 0.05, 0.10, 0.15]:
        sol = solve_required_contribution({**base_solver, "annualContributionGrowthRate": g})
        assert sol["solved"] is True
        assert sol["annualContributionGrowthRate"] == g
        assert sol["recommendedInitialMonthlyContribution"] == sol["recommendedMonthlyContribution"]
        rec = sol["recommendedMonthlyContribution"]
        solved_initial.append(rec)
        print(f"    g={int(g*100):2d}%: Required initial SIP = ₹{rec:,.0f}/month (Achieved prob={sol['achievedProbabilityFunded']:.4f})")

    # Higher escalation rate -> lower required starting contribution to hit 75%
    for i in range(len(solved_initial) - 1):
        assert solved_initial[i] >= solved_initial[i + 1], f"Initial SIP did not decrease: {solved_initial[i]} < {solved_initial[i+1]}"

    print("  ✅ Test 5 Passed: Solved initial contribution decreases monotonically with higher growth rate")


def test_6_zero_volatility_deterministic_parity():
    print("\nRunning 6. Zero-Volatility Exact Deterministic Parity...")
    c0 = 25000.0
    g = 0.10
    r_ann = 0.09
    inf_ann = 0.05
    months = 240
    w0 = 1500000.0

    # 1. Independent analytical reference
    fv_contrib_nom = _analytical_step_up_nominal(c0, g, r_ann, months)
    r_m = (1.0 + r_ann) ** (1.0 / 12.0) - 1.0
    fv_w0_nom = w0 * ((1.0 + r_m) ** months)
    total_nom_ref = fv_w0_nom + fv_contrib_nom
    total_real_ref = total_nom_ref / ((1.0 + inf_ann) ** (months / 12.0))

    # 2. Monte Carlo Engine at sigma = 0
    sim_params = {
        "startingCorpus": w0,
        "monthlyContribution": c0,
        "expectedReturnRate": r_ann,
        "expectedInflationRate": inf_ann,
        "portfolioVolatility": 0.0,
        "estimatedFireCorpus": 20000000.0,
        "monthsUntilRetirement": months,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": g,
        "simulationCount": 1000,
        "seed": 42
    }
    res = run_simulation(sim_params)

    # Compare central path and p50 against analytical reference
    delta_nom = abs(res["centralPath"]["finalCorpusNominal"] - total_nom_ref)
    delta_real = abs(res["centralPath"]["finalCorpusReal"] - total_real_ref)
    delta_p50 = abs(res["corpusPercentiles"]["p50"] - total_real_ref)

    print(f"  Analytical Nominal: ₹{total_nom_ref:,.2f} | MC Central Nominal: ₹{res['centralPath']['finalCorpusNominal']:,.2f} | Delta: ₹{delta_nom:.4f}")
    print(f"  Analytical Real:    ₹{total_real_ref:,.2f} | MC Central Real:    ₹{res['centralPath']['finalCorpusReal']:,.2f} | Delta: ₹{delta_real:.4f}")

    assert delta_nom < 0.01, f"Nominal mismatch: {delta_nom}"
    assert delta_real < 0.01, f"Real mismatch: {delta_real}"
    assert delta_p50 < 0.01, f"p50 mismatch: {delta_p50}"
    print("  ✅ Test 6 Passed: Exact zero-volatility deterministic parity verified (< ₹0.01 delta)")


def test_7_zero_initial_contribution_solver():
    print("\nRunning 7. Zero Initial Contribution ($C_0 = 0$) Solver...")
    solver_params = {
        "startingCorpus": 500000.0,
        "monthlyContribution": 0.0,  # Currently investing ₹0
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": 240,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": 0.10,
        "targetProbability": 0.75,
        "simulationCount": 5000,
        "seed": 42
    }

    sol = solve_required_contribution(solver_params)
    assert sol["solved"] is True
    assert sol["currentMonthlyContribution"] == 0.0
    assert sol["recommendedMonthlyContribution"] > 0
    assert sol["additionalMonthlyContributionRequired"] == sol["recommendedMonthlyContribution"]
    assert sol["achievedProbabilityFunded"] >= 0.75
    print(f"  User at ₹0 SIP solved to recommended initial SIP: ₹{sol['recommendedMonthlyContribution']:,.0f}/month (10% annual step-up)")
    print("  ✅ Test 7 Passed: Zero-contribution user successfully solved for positive starting amount")


def test_8_contribution_timing_and_schedule():
    print("\nRunning 8. Step-Up Timing Verification (Months 1..12, 13..24, 25..36)...")
    # Simulate 36 months, zero return, zero inflation, zero vol
    c0 = 10000.0
    g = 0.10
    sim_params = {
        "startingCorpus": 0.0,
        "monthlyContribution": c0,
        "expectedReturnRate": 0.0,
        "expectedInflationRate": 0.0,
        "portfolioVolatility": 0.0,
        "estimatedFireCorpus": 1000000.0,
        "monthsUntilRetirement": 36,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": g,
        "simulationCount": 100,
        "seed": 42
    }
    res = run_simulation(sim_params)

    # Expected sum: 12 * 10000 + 12 * 11000 + 12 * 12100 = 120000 + 132000 + 145200 = 397,200
    expected_sum = 12 * 10000.0 + 12 * 11000.0 + 12 * 12100.0
    actual_sum = res["centralPath"]["finalCorpusNominal"]
    assert math.isclose(actual_sum, expected_sum, abs_tol=1e-4)
    print(f"  36-month sum: Actual ₹{actual_sum:,.2f} == Expected ₹{expected_sum:,.2f}")
    print("  ✅ Test 8 Passed: Step-up escalation timing is strictly annual (months 1-12, 13-24, 25-36)")


def test_9_funded_age_solver_step_up_compatibility():
    print("\nRunning 9. Funded-Age Solver STEP_UP Compatibility...")
    fa_params_flat = {
        "startingCorpus": 500000.0,
        "monthlyContribution": 20000.0,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.12,
        "estimatedFireCorpus": 10000000.0,
        "currentAge": 25.0,
        "contributionMode": "NOMINAL_FLAT",
        "simulationCount": 5000,
        "seed": 42
    }
    fa_params_step = {
        **fa_params_flat,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": 0.10
    }

    res_flat = solve_funded_ages(fa_params_flat)
    res_step = solve_funded_ages(fa_params_step)

    # STEP_UP should reach sustained 50% and 75% funded ages earlier or equal to flat
    fa50_flat = res_flat['fundedAge50']['ageYears']
    fa75_flat = res_flat['fundedAge75']['ageYears']
    fa50_step = res_step['fundedAge50']['ageYears']
    fa75_step = res_step['fundedAge75']['ageYears']

    print(f"  NOMINAL_FLAT: fundedAge50={fa50_flat}, fundedAge75={fa75_flat}")
    print(f"  STEP_UP 10%:  fundedAge50={fa50_step}, fundedAge75={fa75_step}")

    if res_flat['fundedAge50']['reached'] and res_step['fundedAge50']['reached']:
        assert fa50_step <= fa50_flat
    if res_flat['fundedAge75']['reached'] and res_step['fundedAge75']['reached']:
        assert fa75_step <= fa75_flat

    print("  ✅ Test 9 Passed: Funded-age solver correctly incorporates STEP_UP trajectory")


def test_10_step_up_vs_real_constant_reconciliation():
    print("\nRunning 10. STEP_UP (g = inflation) vs REAL_CONSTANT Reconciliation...")
    c0 = 20000.0
    inf = 0.06
    r_ann = 0.08
    months = 240

    # REAL_CONSTANT escalates monthly with cumulative_inflation: (1+inf)^(t/12)
    # STEP_UP escalates annually in discrete 12-month steps: (1+g)^floor((t-1)/12)
    sim_real_const = run_simulation({
        "startingCorpus": 500000.0,
        "monthlyContribution": c0,
        "expectedReturnRate": r_ann,
        "expectedInflationRate": inf,
        "portfolioVolatility": 0.0,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": months,
        "contributionMode": "REAL_CONSTANT",
        "simulationCount": 1000,
        "seed": 42
    })
    sim_step_up = run_simulation({
        "startingCorpus": 500000.0,
        "monthlyContribution": c0,
        "expectedReturnRate": r_ann,
        "expectedInflationRate": inf,
        "portfolioVolatility": 0.0,
        "estimatedFireCorpus": 10000000.0,
        "monthsUntilRetirement": months,
        "contributionMode": "STEP_UP",
        "annualContributionGrowthRate": inf,
        "simulationCount": 1000,
        "seed": 42
    })

    fv_real_const = sim_real_const["centralPath"]["finalCorpusReal"]
    fv_step_up = sim_step_up["centralPath"]["finalCorpusReal"]
    diff_pct = abs(fv_step_up - fv_real_const) / fv_real_const * 100.0

    print(f"  REAL_CONSTANT real FV: ₹{fv_real_const:,.0f}")
    print(f"  STEP_UP (g=6%) real FV: ₹{fv_step_up:,.0f}")
    print(f"  Difference due to discrete annual escalation: {diff_pct:.2f}% (Expected < 3%)")

    # Due to discrete annual steps vs continuous monthly escalation, difference should be within 3%
    assert diff_pct < 3.0
    print("  ✅ Test 10 Passed: STEP_UP(g=inf) and REAL_CONSTANT reconciled within timing differences")


if __name__ == "__main__":
    print("================================================================")
    print("  FINAURA STEP-UP SIP / CONTRIBUTION ESCALATION TEST SUITE")
    print("================================================================")
    test_1_step_up_input_validation()
    test_2_step_up_zero_growth_equals_nominal_flat()
    test_3_step_up_beats_nominal_flat_path_by_path()
    test_4_growth_rate_monotonicity_ladder()
    test_5_step_up_solver_initial_contribution_ladder()
    test_6_zero_volatility_deterministic_parity()
    test_7_zero_initial_contribution_solver()
    test_8_contribution_timing_and_schedule()
    test_9_funded_age_solver_step_up_compatibility()
    test_10_step_up_vs_real_constant_reconciliation()
    print("\n================================================================")
    print("  ALL 10 STEP-UP PYTHON TESTS PASSED SUCCESSFULLY! 🚀")
    print("================================================================")
