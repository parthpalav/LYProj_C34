"""
ml-service/test_monte_carlo.py

FINAURA Monte Carlo Engine — Comprehensive Phase 1 Test Suite

Tests:
  1.  Zero-volatility parity (NOMINAL_FLAT) — deterministic equivalence
  2.  Zero-volatility parity (REAL_CONSTANT) — deterministic equivalence
  3.  Nonzero-volatility median anchoring — median converges to deterministic
  4.  Reproducibility — same seed = same results, different seed = different
  5.  Distribution invariants — probabilities ∈ [0,1], monotone percentiles, no NaN
  6.  Monotonicity A — ↑ startingCorpus → ↑ fundedProbability
  7.  Monotonicity B — ↑ monthlyContribution → ↑ fundedProbability
  8.  Monotonicity C — ↑ FIRE target → ↓ fundedProbability
  9.  Monotonicity D — ↑ horizon under positive growth → ↑ fundedProbability
  10. Edge cases (15 scenarios)
  11. Central-path vs independent NOMINAL_FLAT reference
  12. Central-path vs independent REAL_CONSTANT reference
  13. t=0 funding detection — FIRE already funded
  14. t=0 funding detection — userGoalCorpus already funded
  15. User goal parallel metrics — same paths, both targets
  16. Input validation — NaN/Infinity/negative rejection
  17. Performance measurement — 1k/5k/10k paths

Runs directly: python3 ml-service/test_monte_carlo.py
"""

import sys
import os
import math
import time

# Ensure ml-service is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from monte_carlo import run_simulation, CONTRIBUTION_MODE_NOMINAL_FLAT, CONTRIBUTION_MODE_REAL_CONSTANT


# ===========================================================================
# Helper: independent deterministic reference calculations
# ===========================================================================

def independent_nominal_flat_reference(
    starting_corpus, monthly_contribution, annual_nominal_return,
    annual_inflation, months
):
    """
    Independently compute the deterministic NOMINAL_FLAT trajectory.
    Matches server/utils/financialMath.js futureValueNominalFlat exactly.

    Returns (final_nominal, final_real).
    """
    monthly_rate = (1.0 + annual_nominal_return) ** (1.0 / 12.0) - 1.0
    # Step through monthly compounding in nominal space
    nominal = starting_corpus
    for t in range(1, months + 1):
        nominal = nominal * (1.0 + monthly_rate) + monthly_contribution
    # Deflate to real
    cumulative_inflation = (1.0 + annual_inflation) ** (months / 12.0)
    real = nominal / cumulative_inflation
    return nominal, real


def independent_real_constant_reference(
    starting_corpus, monthly_contribution, annual_nominal_return,
    annual_inflation, months
):
    """
    Independently compute the deterministic REAL_CONSTANT trajectory.
    In nominal coordinates: contribution[t] = PMT * cumulativeInflation[t].
    Principal grows at nominal rate.

    Returns (final_nominal, final_real).
    """
    monthly_rate = (1.0 + annual_nominal_return) ** (1.0 / 12.0) - 1.0
    monthly_inflation_factor = (1.0 + annual_inflation) ** (1.0 / 12.0)
    cumulative_inf = 1.0
    nominal = starting_corpus
    for t in range(1, months + 1):
        cumulative_inf *= monthly_inflation_factor
        nominal = nominal * (1.0 + monthly_rate) + monthly_contribution * cumulative_inf
    cumulative_inflation = (1.0 + annual_inflation) ** (months / 12.0)
    real = nominal / cumulative_inflation
    return nominal, real


# ===========================================================================
# Base test payload factory
# ===========================================================================

def base_params(**overrides):
    """Standard test payload with sensible defaults."""
    p = {
        "startingCorpus": 1_000_000,
        "monthlyContribution": 20_000,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.15,
        "estimatedFireCorpus": 12_000_000,
        "monthsUntilRetirement": 300,  # 25 years
        "contributionMode": CONTRIBUTION_MODE_NOMINAL_FLAT,
        "simulationCount": 1000,
        "seed": 42,
    }
    p.update(overrides)
    return p


# ===========================================================================
# Test functions
# ===========================================================================

def test_zero_vol_nominal_flat():
    """
    TEST 1: ZERO VOLATILITY PARITY (NOMINAL_FLAT)

    With sigma=0, every MC path must collapse to the independently
    calculated deterministic Base trajectory. Strict tolerance < ₹1.
    """
    params = base_params(
        portfolioVolatility=0.0,
        simulationCount=500,
        seed=12345,
    )
    result = run_simulation(params)

    ref_nominal, ref_real = independent_nominal_flat_reference(
        params["startingCorpus"],
        params["monthlyContribution"],
        params["expectedReturnRate"],
        params["expectedInflationRate"],
        params["monthsUntilRetirement"],
    )

    # Central path must match reference
    assert abs(result["centralPath"]["finalCorpusNominal"] - ref_nominal) < 1.0, (
        f"Central nominal mismatch: {result['centralPath']['finalCorpusNominal']} vs {ref_nominal}"
    )
    assert abs(result["centralPath"]["finalCorpusReal"] - ref_real) < 1.0, (
        f"Central real mismatch: {result['centralPath']['finalCorpusReal']} vs {ref_real}"
    )

    # ALL percentiles must be identical (sigma=0 → all paths identical)
    pcts = result["corpusPercentiles"]
    for key in ["p10", "p25", "p50", "p75", "p90"]:
        assert abs(pcts[key] - ref_real) < 1.0, (
            f"Percentile {key} mismatch: {pcts[key]} vs {ref_real}"
        )

    # All probabilities must be 0 or 1 (deterministic)
    print(f"  Zero-vol NOMINAL_FLAT: ref_real=₹{ref_real:,.0f}, "
          f"MC_p50=₹{pcts['p50']:,.0f}, delta=₹{abs(pcts['p50'] - ref_real):.2f}")
    print("  ✅ Test 1 Passed: Zero-volatility NOMINAL_FLAT parity verified")


def test_zero_vol_real_constant():
    """
    TEST 2: ZERO VOLATILITY PARITY (REAL_CONSTANT)
    """
    params = base_params(
        portfolioVolatility=0.0,
        contributionMode=CONTRIBUTION_MODE_REAL_CONSTANT,
        simulationCount=500,
        seed=99999,
    )
    result = run_simulation(params)

    ref_nominal, ref_real = independent_real_constant_reference(
        params["startingCorpus"],
        params["monthlyContribution"],
        params["expectedReturnRate"],
        params["expectedInflationRate"],
        params["monthsUntilRetirement"],
    )

    assert abs(result["centralPath"]["finalCorpusNominal"] - ref_nominal) < 1.0, (
        f"Central nominal mismatch: {result['centralPath']['finalCorpusNominal']} vs {ref_nominal}"
    )
    assert abs(result["centralPath"]["finalCorpusReal"] - ref_real) < 1.0, (
        f"Central real mismatch: {result['centralPath']['finalCorpusReal']} vs {ref_real}"
    )

    pcts = result["corpusPercentiles"]
    for key in ["p10", "p25", "p50", "p75", "p90"]:
        assert abs(pcts[key] - ref_real) < 1.0, (
            f"Percentile {key} mismatch: {pcts[key]} vs {ref_real}"
        )

    print(f"  Zero-vol REAL_CONSTANT: ref_real=₹{ref_real:,.0f}, "
          f"MC_p50=₹{pcts['p50']:,.0f}, delta=₹{abs(pcts['p50'] - ref_real):.2f}")
    print("  ✅ Test 2 Passed: Zero-volatility REAL_CONSTANT parity verified")


def test_nonzero_vol_median_anchoring():
    """
    TEST 3: NONZERO VOLATILITY MEDIAN ANCHORING

    With large sample and non-zero sigma, the simulated MEDIAN target-age
    corpus should converge toward the deterministic Base corpus within
    justified Monte Carlo tolerance.

    The ARITHMETIC MEAN is expected to be HIGHER than deterministic Base
    (by the variance drag correction). This is intentional.
    """
    params = base_params(
        portfolioVolatility=0.15,
        simulationCount=50_000,
        seed=42,
        monthsUntilRetirement=240,  # 20 years
    )
    result = run_simulation(params)

    ref_nominal, ref_real = independent_nominal_flat_reference(
        params["startingCorpus"],
        params["monthlyContribution"],
        params["expectedReturnRate"],
        params["expectedInflationRate"],
        params["monthsUntilRetirement"],
    )

    median_real = result["corpusPercentiles"]["p50"]

    # Tolerance: 5% of deterministic value for 50k paths, 20-year horizon
    tolerance = ref_real * 0.05
    delta = abs(median_real - ref_real)

    print(f"  Deterministic real: ₹{ref_real:,.0f}")
    print(f"  MC median real:    ₹{median_real:,.0f}")
    print(f"  Delta:             ₹{delta:,.0f} ({delta/ref_real*100:.2f}%)")
    print(f"  Tolerance:         ₹{tolerance:,.0f} (5%)")

    assert delta < tolerance, (
        f"Median anchoring failed: delta ₹{delta:,.0f} exceeds 5% tolerance ₹{tolerance:,.0f}"
    )
    print("  ✅ Test 3 Passed: Nonzero-volatility median anchoring verified")


def test_reproducibility():
    """
    TEST 4: REPRODUCIBILITY

    Same seed → identical results.
    Different seed (with σ > 0) → different results.
    """
    params = base_params(seed=42, simulationCount=500)

    r1 = run_simulation(params)
    r2 = run_simulation(params)

    # Same seed → identical
    assert r1["probabilityFundedAtTargetAge"] == r2["probabilityFundedAtTargetAge"]
    assert r1["corpusPercentiles"] == r2["corpusPercentiles"]
    assert r1["centralPath"] == r2["centralPath"]

    # Different seed → different (with σ > 0)
    r3 = run_simulation(base_params(seed=999, simulationCount=500))
    # probabilityFundedAtTargetAge or percentiles should differ
    # (we don't assert exact amounts but check they're not all identical)
    differs = (
        r1["corpusPercentiles"]["p50"] != r3["corpusPercentiles"]["p50"]
        or r1["probabilityFundedAtTargetAge"] != r3["probabilityFundedAtTargetAge"]
    )
    assert differs, "Different seeds should produce different results with σ > 0"

    print("  ✅ Test 4 Passed: Reproducibility (same seed = same, different seed = different)")


def test_distribution_invariants():
    """
    TEST 5: DISTRIBUTION INVARIANTS

    - All probabilities in [0, 1]
    - p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90
    - No NaN, no Infinity
    - No negative corpus
    """
    result = run_simulation(base_params())

    # Probabilities in [0, 1]
    assert 0 <= result["probabilityFundedAtTargetAge"] <= 1
    assert 0 <= result["probabilityReachedFireByTargetAge"] <= 1
    assert 0 <= result["firstCrossing"]["percentCrossed"] <= 1

    # Percentile ordering
    pcts = result["corpusPercentiles"]
    assert pcts["p10"] <= pcts["p25"] <= pcts["p50"] <= pcts["p75"] <= pcts["p90"]

    # No NaN or Infinity in entire result
    def check_no_nan_inf(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                check_no_nan_inf(v, f"{path}.{k}")
        elif isinstance(obj, (int, float)):
            assert not math.isnan(obj), f"NaN at {path}"
            assert not math.isinf(obj), f"Inf at {path}"

    check_no_nan_inf(result)

    # No negative corpus percentiles
    for key in ["p10", "p25", "p50", "p75", "p90"]:
        assert pcts[key] >= 0, f"Negative corpus at {key}: {pcts[key]}"

    print("  ✅ Test 5 Passed: Distribution invariants verified")


def test_monotonicity_starting_corpus():
    """
    TEST 6: MONOTONICITY A — ↑ startingCorpus → ↑ fundedProbability

    Using common random numbers (same seed).
    """
    low = run_simulation(base_params(startingCorpus=500_000, seed=42))
    high = run_simulation(base_params(startingCorpus=5_000_000, seed=42))

    assert high["probabilityFundedAtTargetAge"] >= low["probabilityFundedAtTargetAge"], (
        f"Monotonicity violated: startingCorpus ↑ but prob ↓: "
        f"{high['probabilityFundedAtTargetAge']} < {low['probabilityFundedAtTargetAge']}"
    )
    print(f"  Corpus 5L→50L: prob {low['probabilityFundedAtTargetAge']:.3f} → "
          f"{high['probabilityFundedAtTargetAge']:.3f}")
    print("  ✅ Test 6 Passed: Monotonicity A (↑ startingCorpus → ↑ prob)")


def test_monotonicity_contribution():
    """
    TEST 7: MONOTONICITY B — ↑ monthlyContribution → ↑ fundedProbability
    """
    low = run_simulation(base_params(monthlyContribution=5_000, seed=42))
    high = run_simulation(base_params(monthlyContribution=50_000, seed=42))

    assert high["probabilityFundedAtTargetAge"] >= low["probabilityFundedAtTargetAge"], (
        f"Monotonicity violated: contribution ↑ but prob ↓"
    )
    print(f"  Contribution 5k→50k: prob {low['probabilityFundedAtTargetAge']:.3f} → "
          f"{high['probabilityFundedAtTargetAge']:.3f}")
    print("  ✅ Test 7 Passed: Monotonicity B (↑ contribution → ↑ prob)")


def test_monotonicity_fire_target():
    """
    TEST 8: MONOTONICITY C — ↑ FIRE target → ↓ fundedProbability
    """
    low_target = run_simulation(base_params(estimatedFireCorpus=5_000_000, seed=42))
    high_target = run_simulation(base_params(estimatedFireCorpus=50_000_000, seed=42))

    assert low_target["probabilityFundedAtTargetAge"] >= high_target["probabilityFundedAtTargetAge"], (
        f"Monotonicity violated: target ↑ but prob ↑"
    )
    print(f"  Target 50L→5Cr: prob {low_target['probabilityFundedAtTargetAge']:.3f} → "
          f"{high_target['probabilityFundedAtTargetAge']:.3f}")
    print("  ✅ Test 8 Passed: Monotonicity C (↑ target → ↓ prob)")


def test_monotonicity_horizon():
    """
    TEST 9: MONOTONICITY D — ↑ horizon under positive growth → ↑ fundedProbability

    Only tested under controlled positive-growth assumptions where the
    relationship should hold. NOT a universal invariant — negative-real-return
    edge cases may violate this.
    """
    # Use positive real return (8% nom - 6% inf ≈ 1.9% real) with moderate volatility
    short = run_simulation(base_params(monthsUntilRetirement=120, seed=42))  # 10 years
    long = run_simulation(base_params(monthsUntilRetirement=360, seed=42))   # 30 years

    assert long["probabilityFundedAtTargetAge"] >= short["probabilityFundedAtTargetAge"], (
        f"Monotonicity violated under positive growth: horizon ↑ but prob ↓: "
        f"{long['probabilityFundedAtTargetAge']} < {short['probabilityFundedAtTargetAge']}"
    )
    print(f"  Horizon 10y→30y: prob {short['probabilityFundedAtTargetAge']:.3f} → "
          f"{long['probabilityFundedAtTargetAge']:.3f}")
    print("  ✅ Test 9 Passed: Monotonicity D (↑ horizon under positive growth → ↑ prob)")


def test_edge_cases():
    """
    TEST 10: EDGE CASES (15 scenarios)
    """
    print("  Running 15 edge case scenarios...")

    # 1. Zero starting corpus
    r = run_simulation(base_params(startingCorpus=0, simulationCount=200))
    assert r["corpusPercentiles"]["p10"] >= 0
    print("    ✅ EC1: Zero starting corpus")

    # 2. Zero monthly contribution
    r = run_simulation(base_params(monthlyContribution=0, simulationCount=200))
    assert r["corpusPercentiles"]["p10"] >= 0
    print("    ✅ EC2: Zero monthly contribution")

    # 3. Zero volatility
    r = run_simulation(base_params(portfolioVolatility=0.0, simulationCount=200))
    pcts = r["corpusPercentiles"]
    assert pcts["p10"] == pcts["p90"]  # all paths identical
    print("    ✅ EC3: Zero volatility → all paths identical")

    # 4. Zero expected return
    r = run_simulation(base_params(expectedReturnRate=0.0, simulationCount=200))
    assert r["corpusPercentiles"]["p50"] >= 0
    print("    ✅ EC4: Zero expected return")

    # 5. Zero inflation
    r = run_simulation(base_params(expectedInflationRate=0.0, simulationCount=200))
    assert r["corpusPercentiles"]["p50"] >= 0
    print("    ✅ EC5: Zero inflation")

    # 6. Target already funded at t=0 (use σ=0 for deterministic certainty)
    r = run_simulation(base_params(
        startingCorpus=50_000_000,
        estimatedFireCorpus=10_000_000,
        portfolioVolatility=0.0,
        simulationCount=200
    ))
    assert r["probabilityFundedAtTargetAge"] == 1.0
    assert r["probabilityReachedFireByTargetAge"] == 1.0
    assert r["firstCrossing"]["percentCrossed"] == 1.0
    assert r["firstCrossing"]["p50Month"] == 0
    print("    ✅ EC6: Target already funded at t=0")

    # 6b. Already funded at t=0 with volatility — paths still start funded
    r6b = run_simulation(base_params(
        startingCorpus=50_000_000,
        estimatedFireCorpus=10_000_000,
        portfolioVolatility=0.15,
        simulationCount=200
    ))
    # All paths must have REACHED fire (t=0 crossing)
    assert r6b["probabilityReachedFireByTargetAge"] == 1.0
    assert r6b["firstCrossing"]["p50Month"] == 0
    # But funded at target may be < 1.0 due to vol (paths can dip)
    print("    ✅ EC6b: Already funded at t=0 with vol → all paths reached, crossing at month 0")

    # 7. Target never reached (very high target, short horizon, no contribution)
    r = run_simulation(base_params(
        startingCorpus=1_000,
        monthlyContribution=0,
        estimatedFireCorpus=1_000_000_000,
        monthsUntilRetirement=12,
        portfolioVolatility=0.0,
        simulationCount=200
    ))
    assert r["probabilityFundedAtTargetAge"] == 0.0
    assert r["probabilityReachedFireByTargetAge"] == 0.0
    print("    ✅ EC7: Target never reached")

    # 8. One-month horizon
    r = run_simulation(base_params(monthsUntilRetirement=1, simulationCount=200))
    assert r["monthsSimulated"] == 1
    print("    ✅ EC8: One-month horizon")

    # 9. Long horizon (50 years)
    r = run_simulation(base_params(monthsUntilRetirement=600, simulationCount=200))
    assert r["monthsSimulated"] == 600
    print("    ✅ EC9: Long horizon (50 years)")

    # 10. Very small positive corpus
    r = run_simulation(base_params(startingCorpus=1, simulationCount=200))
    assert r["corpusPercentiles"]["p10"] >= 0
    print("    ✅ EC10: Very small positive corpus (₹1)")

    # 11. userGoalCorpus absent
    r = run_simulation(base_params(simulationCount=200))
    assert r["userGoal"] is None
    print("    ✅ EC11: userGoalCorpus absent → userGoal is None")

    # 12. userGoalCorpus below estimated FIRE
    r = run_simulation(base_params(
        userGoalCorpus=5_000_000,
        estimatedFireCorpus=12_000_000,
        simulationCount=200
    ))
    assert r["userGoal"] is not None
    assert r["userGoal"]["probabilityFundedAtTargetAge"] >= r["probabilityFundedAtTargetAge"]
    print("    ✅ EC12: userGoalCorpus below FIRE → goal probability ≥ FIRE probability")

    # 13. userGoalCorpus above estimated FIRE
    r = run_simulation(base_params(
        userGoalCorpus=30_000_000,
        estimatedFireCorpus=12_000_000,
        simulationCount=200
    ))
    assert r["userGoal"] is not None
    assert r["userGoal"]["probabilityFundedAtTargetAge"] <= r["probabilityFundedAtTargetAge"]
    print("    ✅ EC13: userGoalCorpus above FIRE → goal probability ≤ FIRE probability")

    # 14. Negative real-return environment
    r = run_simulation(base_params(
        expectedReturnRate=0.04,
        expectedInflationRate=0.08,
        portfolioVolatility=0.10,
        simulationCount=200
    ))
    assert r["corpusPercentiles"]["p50"] >= 0
    print("    ✅ EC14: Negative real return (4% nom, 8% inf)")

    # 15. NaN/Infinity input rejection
    rejected = 0
    try:
        run_simulation(base_params(startingCorpus=float("nan")))
    except (ValueError, TypeError):
        rejected += 1
    try:
        run_simulation(base_params(expectedReturnRate=float("inf")))
    except (ValueError, TypeError):
        rejected += 1
    try:
        run_simulation(base_params(monthlyContribution=-1000))
    except ValueError:
        rejected += 1
    try:
        run_simulation(base_params(estimatedFireCorpus=-5))
    except ValueError:
        rejected += 1
    try:
        run_simulation(base_params(simulationCount=50))  # below minimum
    except ValueError:
        rejected += 1
    assert rejected == 5, f"Expected 5 rejections, got {rejected}"
    print("    ✅ EC15: NaN/Infinity/negative/invalid inputs correctly rejected")

    print("  ✅ Test 10 Passed: All 15 edge cases verified")


def test_central_path_nominal_flat():
    """
    TEST 11: CENTRAL PATH vs INDEPENDENT NOMINAL_FLAT REFERENCE

    Independently reproduce the deterministic NOMINAL_FLAT calculation
    from first principles and compare.
    """
    scenarios = [
        # (startingCorpus, contribution, return, inflation, months)
        (1_000_000, 20_000, 0.08, 0.06, 300),
        (0, 25_000, 0.10, 0.05, 240),
        (5_000_000, 0, 0.08, 0.06, 120),
        (500_000, 10_000, 0.06, 0.06, 180),  # zero real return
        (200_000, 15_000, 0.04, 0.07, 120),  # negative real return
    ]

    for i, (sc, mc, ret, inf, mos) in enumerate(scenarios):
        result = run_simulation(base_params(
            startingCorpus=sc,
            monthlyContribution=mc,
            expectedReturnRate=ret,
            expectedInflationRate=inf,
            monthsUntilRetirement=mos,
            portfolioVolatility=0.0,
            simulationCount=100,
        ))

        ref_nom, ref_real = independent_nominal_flat_reference(sc, mc, ret, inf, mos)

        assert abs(result["centralPath"]["finalCorpusNominal"] - ref_nom) < 1.0, (
            f"Scenario {i+1}: nominal mismatch {result['centralPath']['finalCorpusNominal']} vs {ref_nom}"
        )
        assert abs(result["centralPath"]["finalCorpusReal"] - ref_real) < 1.0, (
            f"Scenario {i+1}: real mismatch {result['centralPath']['finalCorpusReal']} vs {ref_real}"
        )

    print("  ✅ Test 11 Passed: Central path NOMINAL_FLAT matches 5 independent reference scenarios")


def test_central_path_real_constant():
    """
    TEST 12: CENTRAL PATH vs INDEPENDENT REAL_CONSTANT REFERENCE
    """
    scenarios = [
        (1_000_000, 20_000, 0.08, 0.06, 300),
        (0, 25_000, 0.10, 0.05, 240),
        (5_000_000, 0, 0.08, 0.06, 120),
    ]

    for i, (sc, mc, ret, inf, mos) in enumerate(scenarios):
        result = run_simulation(base_params(
            startingCorpus=sc,
            monthlyContribution=mc,
            expectedReturnRate=ret,
            expectedInflationRate=inf,
            monthsUntilRetirement=mos,
            portfolioVolatility=0.0,
            contributionMode=CONTRIBUTION_MODE_REAL_CONSTANT,
            simulationCount=100,
        ))

        ref_nom, ref_real = independent_real_constant_reference(sc, mc, ret, inf, mos)

        assert abs(result["centralPath"]["finalCorpusNominal"] - ref_nom) < 1.0, (
            f"Scenario {i+1}: nominal mismatch"
        )
        assert abs(result["centralPath"]["finalCorpusReal"] - ref_real) < 1.0, (
            f"Scenario {i+1}: real mismatch"
        )

    print("  ✅ Test 12 Passed: Central path REAL_CONSTANT matches 3 independent reference scenarios")


def test_t0_fire_already_funded():
    """
    TEST 13: t=0 FIRE FUNDING DETECTION

    If startingCorpus >= estimatedFireCorpus, the path is already funded
    and firstCrossingMonth must be 0.
    """
    r = run_simulation(base_params(
        startingCorpus=20_000_000,
        estimatedFireCorpus=12_000_000,
        portfolioVolatility=0.0,
        simulationCount=200,
    ))

    assert r["probabilityFundedAtTargetAge"] == 1.0
    assert r["probabilityReachedFireByTargetAge"] == 1.0
    assert r["firstCrossing"]["percentCrossed"] == 1.0
    assert r["firstCrossing"]["p25Month"] == 0
    assert r["firstCrossing"]["p50Month"] == 0
    assert r["firstCrossing"]["p75Month"] == 0
    print("  ✅ Test 13 Passed: t=0 FIRE funding detection (firstCrossingMonth=0)")


def test_t0_user_goal_already_funded():
    """
    TEST 14: t=0 USER GOAL FUNDING DETECTION
    """
    r = run_simulation(base_params(
        startingCorpus=20_000_000,
        estimatedFireCorpus=30_000_000,  # FIRE not funded
        userGoalCorpus=10_000_000,       # Goal IS funded at t=0
        portfolioVolatility=0.0,
        simulationCount=200,
    ))

    assert r["userGoal"]["probabilityFundedAtTargetAge"] == 1.0
    assert r["userGoal"]["probabilityReachedByTargetAge"] == 1.0
    # FIRE should NOT be funded at t=0
    assert r["firstCrossing"]["p50Month"] != 0 or r["probabilityFundedAtTargetAge"] < 1.0
    print("  ✅ Test 14 Passed: t=0 userGoalCorpus funding detection (independent of FIRE)")


def test_user_goal_parallel_metrics():
    """
    TEST 15: USER GOAL PARALLEL METRICS

    Same path set evaluates both estimatedFireCorpus and userGoalCorpus.
    No resimulation.
    """
    # Goal below FIRE
    r1 = run_simulation(base_params(
        estimatedFireCorpus=12_000_000,
        userGoalCorpus=8_000_000,
    ))
    assert r1["userGoal"] is not None
    assert r1["userGoal"]["probabilityFundedAtTargetAge"] >= r1["probabilityFundedAtTargetAge"]

    # Goal above FIRE
    r2 = run_simulation(base_params(
        estimatedFireCorpus=12_000_000,
        userGoalCorpus=25_000_000,
    ))
    assert r2["userGoal"]["probabilityFundedAtTargetAge"] <= r2["probabilityFundedAtTargetAge"]

    print("  ✅ Test 15 Passed: User goal parallel metrics from same path set")


def test_input_validation():
    """
    TEST 16: INPUT VALIDATION

    Comprehensive invalid input rejection.
    """
    cases = [
        ("missing field", {k: v for k, v in base_params().items() if k != "seed"}, ValueError),
        ("NaN corpus", base_params(startingCorpus=float("nan")), ValueError),
        ("Inf return", base_params(expectedReturnRate=float("inf")), ValueError),
        ("-100% return", base_params(expectedReturnRate=-1.0), ValueError),
        ("negative vol", base_params(portfolioVolatility=-0.1), ValueError),
        ("zero FIRE target", base_params(estimatedFireCorpus=0), ValueError),
        ("negative FIRE", base_params(estimatedFireCorpus=-100), ValueError),
        ("zero months", base_params(monthsUntilRetirement=0), ValueError),
        ("float months", base_params(monthsUntilRetirement=12.5), ValueError),
        ("bad mode", base_params(contributionMode="YOLO"), ValueError),
        ("sim count too low", base_params(simulationCount=10), ValueError),
        ("sim count too high", base_params(simulationCount=200_000), ValueError),
        ("string seed", base_params(seed="abc"), TypeError),
        ("negative contribution", base_params(monthlyContribution=-100), ValueError),
    ]

    passed = 0
    for name, params, expected_exc in cases:
        try:
            run_simulation(params)
            assert False, f"  Should have raised {expected_exc.__name__} for: {name}"
        except expected_exc:
            passed += 1
        except Exception as e:
            assert False, f"  Wrong exception for '{name}': got {type(e).__name__}: {e}"

    assert passed == len(cases), f"Only {passed}/{len(cases)} validations caught"
    print(f"  ✅ Test 16 Passed: {len(cases)} invalid inputs correctly rejected")


def test_performance():
    """
    TEST 17: PERFORMANCE MEASUREMENT

    Measure execution time for 1k/5k/10k paths with 300-month horizon.
    """
    print("  Performance results (300-month horizon):")

    for count in [1_000, 5_000, 10_000]:
        params = base_params(
            simulationCount=count,
            monthsUntilRetirement=300,
            seed=42,
        )
        start = time.perf_counter()
        result = run_simulation(params)
        elapsed = time.perf_counter() - start

        print(f"    {count:>6,} paths: {elapsed:.3f}s "
              f"(prob={result['probabilityFundedAtTargetAge']:.3f}, "
              f"p50=₹{result['corpusPercentiles']['p50']:,.0f})")

    print("  ✅ Test 17 Done: Performance measured")


# ===========================================================================
# Main runner
# ===========================================================================

def run_all_tests():
    print("=" * 64)
    print("  FINAURA MONTE CARLO ENGINE — PHASE 1 TEST SUITE")
    print("=" * 64)
    print()

    tests = [
        ("1. Zero-Volatility Parity (NOMINAL_FLAT)", test_zero_vol_nominal_flat),
        ("2. Zero-Volatility Parity (REAL_CONSTANT)", test_zero_vol_real_constant),
        ("3. Nonzero-Volatility Median Anchoring", test_nonzero_vol_median_anchoring),
        ("4. Reproducibility", test_reproducibility),
        ("5. Distribution Invariants", test_distribution_invariants),
        ("6. Monotonicity A: ↑ Starting Corpus", test_monotonicity_starting_corpus),
        ("7. Monotonicity B: ↑ Contribution", test_monotonicity_contribution),
        ("8. Monotonicity C: ↑ FIRE Target", test_monotonicity_fire_target),
        ("9. Monotonicity D: ↑ Horizon (positive growth)", test_monotonicity_horizon),
        ("10. Edge Cases (15 scenarios)", test_edge_cases),
        ("11. Central Path vs Independent NOMINAL_FLAT", test_central_path_nominal_flat),
        ("12. Central Path vs Independent REAL_CONSTANT", test_central_path_real_constant),
        ("13. t=0 FIRE Funding Detection", test_t0_fire_already_funded),
        ("14. t=0 User Goal Funding Detection", test_t0_user_goal_already_funded),
        ("15. User Goal Parallel Metrics", test_user_goal_parallel_metrics),
        ("16. Input Validation (14 cases)", test_input_validation),
        ("17. Performance Measurement", test_performance),
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
        print(f"  ALL {passed} MONTE CARLO TESTS PASSED SUCCESSFULLY! 🚀")
    else:
        print(f"  RESULTS: {passed} passed, {failed} FAILED")
    print("=" * 64)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
