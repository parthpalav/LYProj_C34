"""
ml-service/test_contribution_solver.py

FINAURA Probabilistic Monthly-Contribution Solver — Comprehensive Test Suite

Tests:
  1.  Typical underfunded user solves successfully
  2.  Already sufficient contribution -> returns zero additional contribution
  3.  Zero current contribution -> bracket expansion and solve
  4.  Target probability ladder (50% / 75% / 90%) -> PMT50 <= PMT75 <= PMT90
  5.  Reproducibility -> same seed gives identical solver output
  6.  Contribution probability monotonicity under common random numbers
  7.  Zero-vol NOMINAL_FLAT parity with independent deterministic reference
  8.  Zero-vol REAL_CONSTANT parity with independent deterministic reference
  9.  Very high FIRE target -> multi-step bracket expansion works
  10. Technical ceiling -> returns solved=False gracefully
  11. Invalid targetProbability rejection (<=0, >=1, NaN, Inf)
  12. Invalid recommendationIncrement / tolerance rejection
  13. Rounded recommendation verification (p_rec >= target_prob)
  14. User funded at t=0 but underfunded at horizon T -> positive contribution recommended
  15. Negative real-return environment -> numerical stability
  16. One-month horizon
  17. Long horizon (600 months / 50 years)
  18. No NaN/Infinity anywhere in result dictionary
  19. Target type USER_GOAL support
  20. Performance measurement (10k paths x 300 months & 480 months)

Runs directly: python3 ml-service/test_contribution_solver.py
"""

import sys
import os
import math
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contribution_solver import (
    solve_required_contribution,
    CONTRIBUTION_MODE_NOMINAL_FLAT,
    CONTRIBUTION_MODE_REAL_CONSTANT,
    TARGET_TYPE_ESTIMATED_FIRE,
    TARGET_TYPE_USER_GOAL,
)
from monte_carlo import run_simulation


# ===========================================================================
# Independent Deterministic PMT Reference Functions
# ===========================================================================

def independent_deterministic_pmt_nominal_flat(
    starting_corpus, annual_nominal_return, annual_inflation,
    target_real_corpus, months
):
    """
    Independently solve for required NOMINAL_FLAT contribution from first principles:
      targetNominal = target_real_corpus * (1 + inflation)^(months / 12)
      corpusFV = starting_corpus * (1 + nominal_return)^(months / 12)
      A = ((1 + r_m)^months - 1) / r_m
      PMT = max(0, (targetNominal - corpusFV) / A)
    """
    monthly_rate = (1.0 + annual_nominal_return) ** (1.0 / 12.0) - 1.0
    cumulative_inf = (1.0 + annual_inflation) ** (months / 12.0)
    target_nominal = target_real_corpus * cumulative_inf
    corpus_nominal_fv = starting_corpus * ((1.0 + annual_nominal_return) ** (months / 12.0))

    remaining_nominal = target_nominal - corpus_nominal_fv
    if remaining_nominal <= 0:
        return 0.0

    if abs(monthly_rate) < 1e-12:
        annuity_factor = float(months)
    else:
        annuity_factor = ((1.0 + monthly_rate) ** months - 1.0) / monthly_rate

    return remaining_nominal / annuity_factor


def independent_deterministic_pmt_real_constant(
    starting_corpus, annual_nominal_return, annual_inflation,
    target_real_corpus, months
):
    """
    Independently solve for required REAL_CONSTANT contribution from first principles.
    Using Fisher real return:
      r_real = (1 + nominal) / (1 + inflation) - 1
      r_real_m = (1 + r_real)^(1/12) - 1
      corpus_real_fv = starting_corpus * (1 + r_real_m)^months
      A_real = ((1 + r_real_m)^months - 1) / r_real_m
      PMT_real = max(0, (target_real_corpus - corpus_real_fv) / A_real)
    """
    r_real = (1.0 + annual_nominal_return) / (1.0 + annual_inflation) - 1.0
    r_real_m = (1.0 + r_real) ** (1.0 / 12.0) - 1.0
    corpus_real_fv = starting_corpus * ((1.0 + r_real_m) ** months)

    remaining_real = target_real_corpus - corpus_real_fv
    if remaining_real <= 0:
        return 0.0

    if abs(r_real_m) < 1e-12:
        annuity_factor = float(months)
    else:
        annuity_factor = ((1.0 + r_real_m) ** months - 1.0) / r_real_m

    return remaining_real / annuity_factor


# ===========================================================================
# Base payload factory
# ===========================================================================

def base_solver_params(**overrides):
    p = {
        "startingCorpus": 1_000_000,
        "monthlyContribution": 15_000,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.15,
        "estimatedFireCorpus": 12_000_000,
        "monthsUntilRetirement": 300,  # 25 years
        "contributionMode": CONTRIBUTION_MODE_NOMINAL_FLAT,
        "simulationCount": 2000,
        "seed": 42,
        "targetProbability": 0.75,
        "recommendationIncrement": 100.0,
        "tolerance": 1.0,
    }
    p.update(overrides)
    return p


# ===========================================================================
# Test Cases
# ===========================================================================

def test_typical_underfunded_user():
    """
    TEST 1: Typical underfunded user solves successfully.
    """
    params = base_solver_params()
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["currentProbabilityFunded"] < 0.75
    assert res["achievedProbabilityFunded"] >= 0.75
    assert res["recommendedMonthlyContribution"] > params["monthlyContribution"]
    assert res["additionalMonthlyContributionRequired"] == (
        res["recommendedMonthlyContribution"] - params["monthlyContribution"]
    )
    assert res["recommendedMonthlyContribution"] % 100 == 0
    assert res["requiredMonthlyContributionRaw"] <= res["recommendedMonthlyContribution"]

    print(f"  Current contribution: ₹{params['monthlyContribution']:,} (p={res['currentProbabilityFunded']:.3f})")
    print(f"  Required raw: ₹{res['requiredMonthlyContributionRaw']:,.2f}")
    print(f"  Recommended (₹100 rounded): ₹{res['recommendedMonthlyContribution']:,} (p={res['achievedProbabilityFunded']:.3f})")
    print(f"  Additional required: ₹{res['additionalMonthlyContributionRequired']:,}")
    print("  ✅ Test 1 Passed: Typical underfunded user solved successfully")


def test_already_sufficient_user():
    """
    TEST 2: Already sufficient contribution -> returns zero additional contribution.
    """
    params = base_solver_params(monthlyContribution=80_000)
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["currentProbabilityFunded"] >= 0.75
    assert res["recommendedMonthlyContribution"] == 80_000
    assert res["additionalMonthlyContributionRequired"] == 0.0
    assert res["iterations"] == 0
    assert res["bracketExpansions"] == 0

    print(f"  Already sufficient user: current ₹80k, p={res['currentProbabilityFunded']:.3f}, additional=₹0")
    print("  ✅ Test 2 Passed: Already sufficient user short-circuited with zero additional required")


def test_zero_current_contribution():
    """
    TEST 3: Zero current contribution -> bracket expansion and solve.
    """
    params = base_solver_params(monthlyContribution=0)
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["currentMonthlyContribution"] == 0
    assert res["recommendedMonthlyContribution"] > 0
    assert res["additionalMonthlyContributionRequired"] == res["recommendedMonthlyContribution"]
    assert res["achievedProbabilityFunded"] >= 0.75

    print(f"  Zero current contribution -> recommended ₹{res['recommendedMonthlyContribution']:,}")
    print("  ✅ Test 3 Passed: Zero current contribution bracketed and solved cleanly")


def test_target_probability_ladder():
    """
    TEST 4: Target probability ladder (50% / 75% / 90%) -> PMT50 <= PMT75 <= PMT90.
    """
    params50 = base_solver_params(targetProbability=0.50, seed=42)
    params75 = base_solver_params(targetProbability=0.75, seed=42)
    params90 = base_solver_params(targetProbability=0.90, seed=42)

    res50 = solve_required_contribution(params50)
    res75 = solve_required_contribution(params75)
    res90 = solve_required_contribution(params90)

    assert res50["solved"] and res75["solved"] and res90["solved"]
    assert res50["requiredMonthlyContributionRaw"] <= res75["requiredMonthlyContributionRaw"]
    assert res75["requiredMonthlyContributionRaw"] <= res90["requiredMonthlyContributionRaw"]
    assert res50["recommendedMonthlyContribution"] <= res75["recommendedMonthlyContribution"]
    assert res75["recommendedMonthlyContribution"] <= res90["recommendedMonthlyContribution"]

    print(f"  Ladder 50%: ₹{res50['recommendedMonthlyContribution']:,} (p={res50['achievedProbabilityFunded']:.3f})")
    print(f"  Ladder 75%: ₹{res75['recommendedMonthlyContribution']:,} (p={res75['achievedProbabilityFunded']:.3f})")
    print(f"  Ladder 90%: ₹{res90['recommendedMonthlyContribution']:,} (p={res90['achievedProbabilityFunded']:.3f})")
    print("  ✅ Test 4 Passed: Probability ladder monotonicity (50% <= 75% <= 90%) verified")


def test_reproducibility():
    """
    TEST 5: Reproducibility -> same seed gives identical solver output.
    """
    params = base_solver_params(seed=12345)
    res1 = solve_required_contribution(params)
    res2 = solve_required_contribution(params)

    assert res1 == res2
    print("  ✅ Test 5 Passed: Solver reproducibility verified (exact dictionary match)")


def test_contribution_probability_monotonicity_crn():
    """
    TEST 6: Contribution probability monotonicity under Common Random Numbers.
    """
    params = base_solver_params(simulationCount=2000, seed=999)
    # Test a fine sequence of contributions
    contributions = [0, 5_000, 10_000, 20_000, 30_000, 50_000, 75_000, 100_000]

    probabilities = []
    for c in contributions:
        # Run simulation with exact same seed
        r = run_simulation({**params, "monthlyContribution": c})
        probabilities.append(r["probabilityFundedAtTargetAge"])

    for i in range(len(probabilities) - 1):
        assert probabilities[i] <= probabilities[i + 1], (
            f"Monotonicity violation at contribution index {i}: "
            f"₹{contributions[i]} (p={probabilities[i]}) > ₹{contributions[i+1]} (p={probabilities[i+1]})"
        )

    print(f"  Sampled probabilities: {[round(p, 3) for p in probabilities]}")
    print("  ✅ Test 6 Passed: Empirical probability strictly monotonic under CRN")


def test_zero_vol_parity_nominal_flat():
    """
    TEST 7: Zero-vol NOMINAL_FLAT parity with independent deterministic calculation.
    """
    scenarios = [
        # (startingCorpus, expectedReturnRate, expectedInflationRate, estimatedFireCorpus, months)
        (1_000_000, 0.08, 0.06, 12_000_000, 300),
        (0, 0.10, 0.05, 15_000_000, 240),
        (5_000_000, 0.08, 0.06, 20_000_000, 180),
        (500_000, 0.06, 0.06, 10_000_000, 240),  # zero real return
        (200_000, 0.04, 0.07, 8_000_000, 120),   # negative real return
    ]

    for i, (sc, ret, inf, fire, mos) in enumerate(scenarios):
        # Target probability 0.75 under zero-vol: all paths are identical, so threshold is deterministic
        params = base_solver_params(
            startingCorpus=sc,
            monthlyContribution=0,
            expectedReturnRate=ret,
            expectedInflationRate=inf,
            portfolioVolatility=0.0,
            estimatedFireCorpus=fire,
            monthsUntilRetirement=mos,
            contributionMode=CONTRIBUTION_MODE_NOMINAL_FLAT,
            tolerance=0.01,  # 1 paisa precision
            simulationCount=100,
            seed=42,
        )
        res = solve_required_contribution(params)
        ref_pmt = independent_deterministic_pmt_nominal_flat(sc, ret, inf, fire, mos)

        delta = abs(res["requiredMonthlyContributionRaw"] - ref_pmt)
        print(f"  Scenario {i+1}: ref PMT=₹{ref_pmt:,.2f}, solver raw=₹{res['requiredMonthlyContributionRaw']:,.2f}, delta=₹{delta:.4f}")
        assert delta < 1.0, f"Scenario {i+1} mismatch: delta ₹{delta} >= ₹1.0"

    print("  ✅ Test 7 Passed: Zero-vol NOMINAL_FLAT parity matches 5 deterministic scenarios within < ₹1")


def test_zero_vol_parity_real_constant():
    """
    TEST 8: Zero-vol REAL_CONSTANT parity with independent deterministic calculation.
    """
    scenarios = [
        (1_000_000, 0.08, 0.06, 12_000_000, 300),
        (0, 0.10, 0.05, 15_000_000, 240),
        (5_000_000, 0.08, 0.06, 20_000_000, 180),
    ]

    for i, (sc, ret, inf, fire, mos) in enumerate(scenarios):
        params = base_solver_params(
            startingCorpus=sc,
            monthlyContribution=0,
            expectedReturnRate=ret,
            expectedInflationRate=inf,
            portfolioVolatility=0.0,
            estimatedFireCorpus=fire,
            monthsUntilRetirement=mos,
            contributionMode=CONTRIBUTION_MODE_REAL_CONSTANT,
            tolerance=0.01,
            simulationCount=100,
            seed=42,
        )
        res = solve_required_contribution(params)
        ref_pmt = independent_deterministic_pmt_real_constant(sc, ret, inf, fire, mos)

        delta = abs(res["requiredMonthlyContributionRaw"] - ref_pmt)
        print(f"  REAL_CONSTANT Scenario {i+1}: ref PMT=₹{ref_pmt:,.2f}, solver raw=₹{res['requiredMonthlyContributionRaw']:,.2f}, delta=₹{delta:.4f}")
        assert delta < 1.0, f"Scenario {i+1} mismatch: delta ₹{delta} >= ₹1.0"

    print("  ✅ Test 8 Passed: Zero-vol REAL_CONSTANT parity matches 3 deterministic scenarios within < ₹1")


def test_high_fire_target_bracket_expansion():
    """
    TEST 9: Very high FIRE target -> multi-step bracket expansion works.
    """
    params = base_solver_params(
        monthlyContribution=1_000,
        estimatedFireCorpus=500_000_000,  # ₹50 Crore target
        monthsUntilRetirement=120,        # 10 years
        simulationCount=1000,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["bracketExpansions"] > 3
    assert res["achievedProbabilityFunded"] >= 0.75
    print(f"  ₹50Cr target in 10y solved after {res['bracketExpansions']} expansions: recommended ₹{res['recommendedMonthlyContribution']:,}")
    print("  ✅ Test 9 Passed: Multi-step bracket expansion verified")


def test_technical_ceiling_unsolved():
    """
    TEST 10: Technical ceiling -> returns solved=False gracefully when target is unreachable.
    """
    params = base_solver_params(
        startingCorpus=0,
        monthlyContribution=0,
        estimatedFireCorpus=1_000_000_000_000,  # ₹1 Trillion target
        monthsUntilRetirement=1,                # 1 month
        targetProbability=0.99,
        maxMonthlyContribution=100_000.0,      # Low technical ceiling for test
        simulationCount=500,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is False
    assert res["reason"] == "TARGET_PROBABILITY_NOT_REACHED_WITHIN_SEARCH_LIMIT"
    assert res["maximumContributionTested"] == 100_000.0
    print(f"  Unsolved result: {res['reason']}, max tested: ₹{res['maximumContributionTested']:,}")
    print("  ✅ Test 10 Passed: Technical ceiling handled gracefully with solved=False")


def test_invalid_target_probability():
    """
    TEST 11: Invalid targetProbability rejection (<=0, >=1, NaN, Inf, string).
    """
    invalid_cases = [0.0, 1.0, -0.5, 1.5, float("nan"), float("inf"), "0.75"]
    rejections = 0
    for val in invalid_cases:
        try:
            solve_required_contribution(base_solver_params(targetProbability=val))
            assert False, f"Should have rejected targetProbability={val}"
        except (ValueError, TypeError):
            rejections += 1

    assert rejections == len(invalid_cases)
    print(f"  Rejected {rejections}/{len(invalid_cases)} invalid targetProbability inputs")
    print("  ✅ Test 11 Passed: Invalid targetProbability strictly rejected")


def test_invalid_recommendation_increment_and_tolerance():
    """
    TEST 12: Invalid recommendationIncrement / tolerance rejection.
    """
    invalid_increments = [0.0, -100.0, float("nan"), float("inf"), "100"]
    for val in invalid_increments:
        try:
            solve_required_contribution(base_solver_params(recommendationIncrement=val))
            assert False, f"Should have rejected recommendationIncrement={val}"
        except (ValueError, TypeError):
            pass

    invalid_tolerances = [0.0, -1.0, float("nan"), float("inf"), "1.0"]
    for val in invalid_tolerances:
        try:
            solve_required_contribution(base_solver_params(tolerance=val))
            assert False, f"Should have rejected tolerance={val}"
        except (ValueError, TypeError):
            pass

    print("  ✅ Test 12 Passed: Invalid increment and tolerance rejected")


def test_rounded_recommendation_verification():
    """
    TEST 13: Rounded recommendation verification (recommended amount actually satisfies target prob).
    """
    params = base_solver_params(recommendationIncrement=500.0, simulationCount=3000)
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["recommendedMonthlyContribution"] % 500.0 == 0
    assert res["achievedProbabilityFunded"] >= 0.75

    # Re-run direct simulation at recommended amount to independently verify
    sim_res = run_simulation({**params, "monthlyContribution": res["recommendedMonthlyContribution"]})
    assert sim_res["probabilityFundedAtTargetAge"] >= 0.75
    assert sim_res["probabilityFundedAtTargetAge"] == res["achievedProbabilityFunded"]

    print(f"  Raw: ₹{res['requiredMonthlyContributionRaw']:,.2f} -> Rounded (₹500 step): ₹{res['recommendedMonthlyContribution']:,}")
    print(f"  Verified simulation probability: {sim_res['probabilityFundedAtTargetAge']:.3f} >= 0.75")
    print("  ✅ Test 13 Passed: Rounded recommendation verified against independent simulation")


def test_funded_at_t0_but_underfunded_at_horizon():
    """
    TEST 14: User funded at t=0 but underfunded at horizon T due to inflation/volatility.
    """
    params = base_solver_params(
        startingCorpus=12_000_000,      # Equal to today's FIRE target of ₹1.2Cr
        monthlyContribution=0,
        estimatedFireCorpus=12_000_000,
        expectedReturnRate=0.04,        # Low return
        expectedInflationRate=0.07,     # High inflation (negative real return)
        portfolioVolatility=0.18,       # High vol
        monthsUntilRetirement=240,
        targetProbability=0.85,
        simulationCount=2000,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is True
    # At t=0 starting corpus == FIRE target, but at 20y with neg real return & vol, p_current < 0.85
    assert res["currentProbabilityFunded"] < 0.85
    assert res["recommendedMonthlyContribution"] > 0
    assert res["additionalMonthlyContributionRequired"] > 0
    assert res["achievedProbabilityFunded"] >= 0.85

    print(f"  t=0 funded user at 20y horizon: pCurrent={res['currentProbabilityFunded']:.3f}, solved recommended=₹{res['recommendedMonthlyContribution']:,} (p={res['achievedProbabilityFunded']:.3f})")
    print("  ✅ Test 14 Passed: t=0 funded user underfunded at horizon correctly receives contribution recommendation")


def test_negative_real_return_stability():
    """
    TEST 15: Negative real-return environment -> numerical stability.
    """
    params = base_solver_params(
        expectedReturnRate=0.03,
        expectedInflationRate=0.08,
        portfolioVolatility=0.12,
        simulationCount=1000,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["recommendedMonthlyContribution"] > 0
    assert res["achievedProbabilityFunded"] >= 0.75
    print("  ✅ Test 15 Passed: Negative real return environment solved stably")


def test_one_month_horizon():
    """
    TEST 16: One-month horizon.
    """
    params = base_solver_params(
        startingCorpus=10_000_000,
        estimatedFireCorpus=12_000_000,
        monthsUntilRetirement=1,
        simulationCount=1000,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["monthsSimulated"] == 1
    assert res["achievedProbabilityFunded"] >= 0.75
    print(f"  1-month horizon: recommended ₹{res['recommendedMonthlyContribution']:,}")
    print("  ✅ Test 16 Passed: One-month horizon solved")


def test_long_horizon_50y():
    """
    TEST 17: Long horizon (600 months / 50 years).
    """
    params = base_solver_params(
        startingCorpus=500_000,
        monthlyContribution=5_000,
        monthsUntilRetirement=600,
        simulationCount=1000,
    )
    res = solve_required_contribution(params)

    assert res["solved"] is True
    assert res["monthsSimulated"] == 600
    assert res["achievedProbabilityFunded"] >= 0.75
    print(f"  50-year horizon: recommended ₹{res['recommendedMonthlyContribution']:,}")
    print("  ✅ Test 17 Passed: 50-year horizon solved")


def test_no_nan_or_inf_in_result():
    """
    TEST 18: No NaN/Infinity anywhere in result dictionary.
    """
    params = base_solver_params()
    res = solve_required_contribution(params)

    def check_clean(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                check_clean(v, f"{path}.{k}")
        elif isinstance(obj, (int, float)):
            assert not math.isnan(obj), f"NaN at {path}"
            assert not math.isinf(obj), f"Inf at {path}"

    check_clean(res)
    print("  ✅ Test 18 Passed: Zero NaN/Infinity in result object")


def test_target_type_user_goal():
    """
    TEST 19: Target type USER_GOAL support.
    """
    # estimatedFire = 12M, userGoal = 8M (easier)
    params_fire = base_solver_params(
        estimatedFireCorpus=12_000_000,
        userGoalCorpus=8_000_000,
        targetType=TARGET_TYPE_ESTIMATED_FIRE,
        seed=42,
    )
    params_goal = base_solver_params(
        estimatedFireCorpus=12_000_000,
        userGoalCorpus=8_000_000,
        targetType=TARGET_TYPE_USER_GOAL,
        seed=42,
    )

    res_fire = solve_required_contribution(params_fire)
    res_goal = solve_required_contribution(params_goal)

    assert res_fire["solved"] and res_goal["solved"]
    assert res_goal["recommendedMonthlyContribution"] <= res_fire["recommendedMonthlyContribution"]

    print(f"  FIRE target (₹1.2Cr) PMT: ₹{res_fire['recommendedMonthlyContribution']:,}")
    print(f"  User Goal (₹80L) PMT:     ₹{res_goal['recommendedMonthlyContribution']:,}")
    print("  ✅ Test 19 Passed: Target type USER_GOAL solved independently")


def test_solver_performance():
    """
    TEST 20: Performance measurement (10k paths x 300 months & 480 months).
    """
    print("  Measuring solver execution performance...")

    # 10k paths x 300 months
    params_300m = base_solver_params(
        simulationCount=10_000,
        monthsUntilRetirement=300,
        seed=42,
    )
    t0 = time.perf_counter()
    res_300m = solve_required_contribution(params_300m)
    t_300m = time.perf_counter() - t0

    print(f"    10,000 paths x 300 months: {t_300m:.3f}s (bisections={res_300m['iterations']}, expansions={res_300m['bracketExpansions']}, recommended=₹{res_300m['recommendedMonthlyContribution']:,})")

    # 10k paths x 480 months (40 years)
    params_480m = base_solver_params(
        simulationCount=10_000,
        monthsUntilRetirement=480,
        seed=42,
    )
    t0 = time.perf_counter()
    res_480m = solve_required_contribution(params_480m)
    t_480m = time.perf_counter() - t0

    print(f"    10,000 paths x 480 months: {t_480m:.3f}s (bisections={res_480m['iterations']}, expansions={res_480m['bracketExpansions']}, recommended=₹{res_480m['recommendedMonthlyContribution']:,})")

    print("  ✅ Test 20 Done: Solver performance measured")


# ===========================================================================
# Main Runner
# ===========================================================================

def run_all_solver_tests():
    print("=" * 64)
    print("  FINAURA CONTRIBUTION SOLVER — PHASE 2 TEST SUITE")
    print("=" * 64)
    print()

    tests = [
        ("1. Typical Underfunded User Solve", test_typical_underfunded_user),
        ("2. Already Sufficient User Short-Circuit", test_already_sufficient_user),
        ("3. Zero Current Contribution Bracket & Solve", test_zero_current_contribution),
        ("4. Probability Ladder Monotonicity (50/75/90)", test_target_probability_ladder),
        ("5. Seed Reproducibility", test_reproducibility),
        ("6. CRN Contribution Probability Monotonicity", test_contribution_probability_monotonicity_crn),
        ("7. Zero-Vol NOMINAL_FLAT Parity (5 Scenarios)", test_zero_vol_parity_nominal_flat),
        ("8. Zero-Vol REAL_CONSTANT Parity (3 Scenarios)", test_zero_vol_parity_real_constant),
        ("9. High FIRE Target Multi-Bracket Expansion", test_high_fire_target_bracket_expansion),
        ("10. Technical Ceiling Unsolved Result", test_technical_ceiling_unsolved),
        ("11. Invalid Target Probability Rejection", test_invalid_target_probability),
        ("12. Invalid Increment and Tolerance Rejection", test_invalid_recommendation_increment_and_tolerance),
        ("13. Rounded Recommendation Verification", test_rounded_recommendation_verification),
        ("14. t=0 Funded but Horizon Underfunded User", test_funded_at_t0_but_underfunded_at_horizon),
        ("15. Negative Real Return Stability", test_negative_real_return_stability),
        ("16. One-Month Horizon", test_one_month_horizon),
        ("17. Long Horizon (50 Years / 600 Months)", test_long_horizon_50y),
        ("18. No NaN/Infinity in Result Object", test_no_nan_or_inf_in_result),
        ("19. Target Type USER_GOAL Support", test_target_type_user_goal),
        ("20. Solver Performance (10k x 300m & 480m)", test_solver_performance),
    ]

    passed = 0
    failed = 0

    for name, fn in tests:
        print(f"Running {name}...")
        try:
            fn()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"  ❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
        print()

    print("=" * 64)
    if failed == 0:
        print(f"  ALL {passed} CONTRIBUTION SOLVER TESTS PASSED SUCCESSFULLY! 🚀")
    else:
        print(f"  RESULTS: {passed} passed, {failed} FAILED")
    print("=" * 64)

    return failed == 0


if __name__ == "__main__":
    success = run_all_solver_tests()
    sys.exit(0 if success else 1)
