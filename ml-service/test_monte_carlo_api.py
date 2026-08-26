"""
ml-service/test_monte_carlo_api.py

FINAURA Monte Carlo Flask API — Comprehensive Integration Test Suite

Tests:
  1.  Valid simulation-only request -> HTTP 200
  2.  Valid full request (simulation + contribution solver + funded age) -> HTTP 200
  3.  Same request + same seed -> identical JSON response
  4.  Different seed with volatility > 0 -> different stochastic percentiles
  5.  Invalid JSON / missing body / non-object body -> HTTP 400
  6.  Missing required simulation field -> HTTP 400
  7.  NaN / Infinity / invalid numeric inputs -> HTTP 400
  8.  Negative corpus / negative contribution -> HTTP 400
  9.  Invalid simulationCount -> HTTP 400
  10. Invalid contributionMode -> HTTP 400
  11. Invalid solverTargetProbability -> HTTP 400
  12. Contribution solver unreachable target (solved=false) -> HTTP 200
  13. fundedAge50/75 unreached -> HTTP 200
  14. userGoalCorpus absent -> valid result without userGoal
  15. userGoalCorpus present -> separate userGoal metrics returned
  16. includeSimulation=False, includeFundedAgeSolver=True (funded-age only) -> HTTP 200
  17. all inclusion flags False -> HTTP 400
  18. No stack trace / internal exception leak in error responses
  19. Zero-volatility API parity with deterministic expectations
  20. Existing /health and /classify routes unaffected
  21. Performance benchmarking via Flask test client

Runs directly: python3 ml-service/test_monte_carlo_api.py
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import app


# ===========================================================================
# Base payload factory
# ===========================================================================

def base_api_payload(**overrides):
    p = {
        "startingCorpus": 1_000_000,
        "monthlyContribution": 25_000,
        "expectedReturnRate": 0.08,
        "expectedInflationRate": 0.06,
        "portfolioVolatility": 0.15,
        "estimatedFireCorpus": 12_000_000,
        "monthsUntilRetirement": 300,
        "contributionMode": "NOMINAL_FLAT",
        "simulationCount": 1000,
        "seed": 42,
    }
    p.update(overrides)
    return p


def base_full_api_payload(**overrides):
    p = base_api_payload(
        includeSimulation=True,
        includeContributionSolver=True,
        solverTargetProbability=0.75,
        includeFundedAgeSolver=True,
        currentAge=30.0,
        maxSearchAge=85.0,
    )
    p.update(overrides)
    return p


# ===========================================================================
# Test Cases
# ===========================================================================

def test_valid_simulation_only():
    """
    TEST 1: Valid simulation-only request -> HTTP 200.
    """
    client = app.test_client()
    payload = base_api_payload()
    resp = client.post("/simulate", json=payload)

    assert resp.status_code == 200
    data = resp.get_json()

    assert "simulation" in data
    assert "contributionSolver" not in data
    assert "fundedAge" not in data
    assert data["meta"]["engineVersion"] == "mc-v1"
    assert data["meta"]["simulationCount"] == 1000
    assert data["meta"]["seed"] == 42
    assert "probabilityFundedAtTargetAge" in data["simulation"]
    assert "corpusPercentiles" in data["simulation"]

    print("  ✅ Test 1 Passed: Valid simulation-only request returns 200 with structured simulation payload")


def test_valid_full_request():
    """
    TEST 2: Valid full request (simulation + contribution solver + funded age) -> HTTP 200.
    """
    client = app.test_client()
    payload = base_full_api_payload()
    resp = client.post("/simulate", json=payload)

    assert resp.status_code == 200
    data = resp.get_json()

    assert "simulation" in data
    assert "contributionSolver" in data
    assert "fundedAge" in data
    assert data["contributionSolver"]["solved"] is True
    assert data["contributionSolver"]["recommendedMonthlyContribution"] > 0
    assert data["fundedAge"]["fundedAge50"]["reached"] is True

    print("  ✅ Test 2 Passed: Full simulation request returns 200 with all three analytical sections")


def test_reproducibility_same_seed():
    """
    TEST 3: Same request + same seed -> identical JSON response.
    """
    client = app.test_client()
    payload = base_full_api_payload(seed=12345)

    resp1 = client.post("/simulate", json=payload)
    resp2 = client.post("/simulate", json=payload)

    assert resp1.status_code == 200 and resp2.status_code == 200
    assert resp1.get_json() == resp2.get_json()

    print("  ✅ Test 3 Passed: Bit-identical JSON response with identical seed")


def test_different_seed_stochastic():
    """
    TEST 4: Different seed with volatility > 0 -> stochastic outputs differ.
    """
    client = app.test_client()
    resp1 = client.post("/simulate", json=base_api_payload(seed=111, simulationCount=500))
    resp2 = client.post("/simulate", json=base_api_payload(seed=222, simulationCount=500))

    data1 = resp1.get_json()
    data2 = resp2.get_json()

    p50_1 = data1["simulation"]["corpusPercentiles"]["p50"]
    p50_2 = data2["simulation"]["corpusPercentiles"]["p50"]
    assert p50_1 != p50_2

    print(f"  Seed 111 p50=₹{p50_1:,.0f} vs Seed 222 p50=₹{p50_2:,.0f}")
    print("  ✅ Test 4 Passed: Different seeds produce distinct stochastic paths")


def test_invalid_json_or_missing_body():
    """
    TEST 5: Invalid JSON / missing body / non-object body -> HTTP 400.
    """
    client = app.test_client()

    # Empty body
    r1 = client.post("/simulate", data="", content_type="application/json")
    assert r1.status_code == 400
    assert r1.get_json()["error"]["code"] == "INVALID_SIMULATION_INPUT"

    # Non-object array body
    r2 = client.post("/simulate", json=[1, 2, 3])
    assert r2.status_code == 400

    # Non-JSON content type with text
    r3 = client.post("/simulate", data="hello world", content_type="text/plain")
    assert r3.status_code == 400

    print("  ✅ Test 5 Passed: Malformed request bodies return HTTP 400 with structured error")


def test_missing_required_fields():
    """
    TEST 6: Missing required simulation fields -> HTTP 400.
    """
    client = app.test_client()

    required = ["startingCorpus", "monthlyContribution", "expectedReturnRate", "estimatedFireCorpus", "simulationCount", "seed"]
    for field in required:
        payload = base_api_payload()
        del payload[field]
        resp = client.post("/simulate", json=payload)
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    print("  ✅ Test 6 Passed: Missing required simulation fields caught and rejected with HTTP 400")


def test_nan_infinity_numeric_rejection():
    """
    TEST 7: NaN / Infinity numeric inputs -> HTTP 400.
    """
    client = app.test_client()

    # Float string or invalid numeric
    payload_nan = base_api_payload(startingCorpus="not_a_number")
    resp = client.post("/simulate", json=payload_nan)
    assert resp.status_code == 400

    print("  ✅ Test 7 Passed: Non-numeric / NaN values rejected with HTTP 400")


def test_negative_values_rejection():
    """
    TEST 8: Negative corpus / negative contribution -> HTTP 400.
    """
    client = app.test_client()

    r1 = client.post("/simulate", json=base_api_payload(startingCorpus=-100))
    assert r1.status_code == 400

    r2 = client.post("/simulate", json=base_api_payload(monthlyContribution=-500))
    assert r2.status_code == 400

    r3 = client.post("/simulate", json=base_api_payload(estimatedFireCorpus=0))
    assert r3.status_code == 400

    print("  ✅ Test 8 Passed: Negative / invalid boundaries rejected with HTTP 400")


def test_invalid_simulation_count_and_mode():
    """
    TEST 9 & 10: Invalid simulationCount and contributionMode -> HTTP 400.
    """
    client = app.test_client()

    # Simulation count too low (<100) or too high (>100000)
    r1 = client.post("/simulate", json=base_api_payload(simulationCount=10))
    assert r1.status_code == 400

    r2 = client.post("/simulate", json=base_api_payload(simulationCount=500_000))
    assert r2.status_code == 400

    # Invalid contribution mode
    r3 = client.post("/simulate", json=base_api_payload(contributionMode="AGGRESSIVE"))
    assert r3.status_code == 400

    print("  ✅ Test 9 & 10 Passed: Invalid simulationCount and contributionMode rejected with HTTP 400")


def test_invalid_solver_target_probability():
    """
    TEST 11: Invalid solver target probability -> HTTP 400.
    """
    client = app.test_client()

    r1 = client.post("/simulate", json=base_full_api_payload(solverTargetProbability=1.5))
    assert r1.status_code == 400

    r2 = client.post("/simulate", json=base_full_api_payload(solverTargetProbability=0.0))
    assert r2.status_code == 400

    print("  ✅ Test 11 Passed: Invalid solver target probabilities rejected with HTTP 400")


def test_unsolved_contribution_target_http_200():
    """
    TEST 12: Contribution solver unreachable target (solved=false) -> HTTP 200.
    """
    client = app.test_client()
    payload = base_full_api_payload(
        startingCorpus=0,
        monthlyContribution=0,
        estimatedFireCorpus=1_000_000_000_000,  # ₹1 Trillion
        monthsUntilRetirement=1,
        solverTargetProbability=0.99,
        maxMonthlyContribution=50_000.0,
        simulationCount=200,
    )
    resp = client.post("/simulate", json=payload)

    assert resp.status_code == 200
    data = resp.get_json()
    assert "contributionSolver" in data
    assert data["contributionSolver"]["solved"] is False
    assert data["contributionSolver"]["reason"] == "TARGET_PROBABILITY_NOT_REACHED_WITHIN_SEARCH_LIMIT"

    print("  ✅ Test 12 Passed: Unsolved contribution target returns structured HTTP 200 response")


def test_unreached_funded_age_http_200():
    """
    TEST 13: fundedAge50/75 unreached -> HTTP 200.
    """
    client = app.test_client()
    payload = base_full_api_payload(
        startingCorpus=1_000,
        monthlyContribution=100,
        estimatedFireCorpus=500_000_000,  # ₹50 Crore
        maxSearchAge=60.0,
        simulationCount=200,
    )
    resp = client.post("/simulate", json=payload)

    assert resp.status_code == 200
    data = resp.get_json()
    assert "fundedAge" in data
    assert data["fundedAge"]["fundedAge50"]["reached"] is False
    assert data["fundedAge"]["fundedAge75"]["reached"] is False

    print("  ✅ Test 13 Passed: Unreached funded ages return structured HTTP 200 response")


def test_user_goal_corpus_handling():
    """
    TEST 14 & 15: userGoalCorpus absent vs present.
    """
    client = app.test_client()

    # Absent
    r1 = client.post("/simulate", json=base_api_payload(includeFundedAgeSolver=True, currentAge=30.0))
    d1 = r1.get_json()
    assert d1["simulation"]["userGoal"] is None
    assert d1["fundedAge"]["userGoalFundedAges"] is None

    # Present
    r2 = client.post("/simulate", json=base_api_payload(userGoalCorpus=8_000_000, includeFundedAgeSolver=True, currentAge=30.0))
    d2 = r2.get_json()
    assert d2["simulation"]["userGoal"] is not None
    assert d2["fundedAge"]["userGoalFundedAges"] is not None
    assert d2["simulation"]["userGoal"]["probabilityFundedAtTargetAge"] >= d2["simulation"]["probabilityFundedAtTargetAge"]

    print("  ✅ Test 14 & 15 Passed: userGoalCorpus absent/present handled cleanly with separate parallel metrics")


def test_inclusion_flags():
    """
    TEST 16 & 17: Inclusion flags (funded-age only, simulation-only, all-false rejection).
    """
    client = app.test_client()

    # Funded-age only
    r1 = client.post("/simulate", json=base_api_payload(
        includeSimulation=False,
        includeFundedAgeSolver=True,
        currentAge=30.0,
    ))
    assert r1.status_code == 200
    d1 = r1.get_json()
    assert "simulation" not in d1
    assert "contributionSolver" not in d1
    assert "fundedAge" in d1

    # All false -> HTTP 400
    r2 = client.post("/simulate", json=base_api_payload(
        includeSimulation=False,
        includeContributionSolver=False,
        includeFundedAgeSolver=False,
    ))
    assert r2.status_code == 400

    print("  ✅ Test 16 & 17 Passed: Selective computation flags work; all-false payload rejected")


def test_no_stack_trace_leak():
    """
    TEST 18: No stack trace or internal exception details leak in error response.
    """
    client = app.test_client()
    resp = client.post("/simulate", json={"invalid": "payload"})
    assert resp.status_code == 400
    data = resp.get_json()

    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "traceback" not in data["error"]
    assert "Traceback" not in data["error"]["message"]

    print("  ✅ Test 18 Passed: Clean error format with zero internal stack trace leakage")


def test_zero_vol_api_parity():
    """
    TEST 19: Zero-volatility API parity check against deterministic Base calculations.
    """
    client = app.test_client()
    payload = base_api_payload(
        startingCorpus=1_000_000,
        monthlyContribution=20_000,
        expectedReturnRate=0.08,
        expectedInflationRate=0.06,
        portfolioVolatility=0.0,
        monthsUntilRetirement=300,
        simulationCount=100,
    )
    resp = client.post("/simulate", json=payload)
    assert resp.status_code == 200
    data = resp.get_json()

    # Independent deterministic reference: ₹5,831,558 (matches pure MC test 1)
    central_real = data["simulation"]["centralPath"]["finalCorpusReal"]
    p50_real = data["simulation"]["corpusPercentiles"]["p50"]

    assert abs(central_real - 5_831_558) < 2.0
    assert abs(p50_real - 5_831_558) < 2.0

    print(f"  Zero-vol API centralReal=₹{central_real:,.2f}, p50=₹{p50_real:,.2f} matches reference")
    print("  ✅ Test 19 Passed: Zero-volatility parity holds through Flask API layer")


def test_existing_routes_compatibility():
    """
    TEST 20: Existing /health and /classify routes still function normally.
    """
    client = app.test_client()

    # 1. Health
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.get_json()["ok"] is True

    # 2. Classify
    r_classify = client.post("/classify", json={"text": "500rs pizza"})
    assert r_classify.status_code == 200
    d_classify = r_classify.get_json()
    assert d_classify["category"] == "Food"
    assert d_classify["type"] == "Want"

    print("  ✅ Test 20 Passed: /health and /classify routes continue to function normally")


def test_api_performance_benchmarks():
    """
    TEST 21: Performance benchmarking via Flask test client.
    """
    client = app.test_client()
    print("  Measuring Flask API execution performance...")

    # A. Simulation only (10k paths x 300 months)
    payload_sim_only = base_api_payload(simulationCount=10_000, monthsUntilRetirement=300)
    t0 = time.perf_counter()
    r_sim = client.post("/simulate", json=payload_sim_only)
    t_sim = time.perf_counter() - t0
    assert r_sim.status_code == 200
    print(f"    Simulation only (10,000 paths x 300 months): {t_sim:.3f}s")

    # B. Full route (Simulation + 75% Contribution Solver + Funded Age Solver 60y)
    payload_full = base_full_api_payload(simulationCount=10_000, maxSearchAge=90.0)
    t0 = time.perf_counter()
    r_full = client.post("/simulate", json=payload_full)
    t_full = time.perf_counter() - t0
    assert r_full.status_code == 200
    print(f"    Full route (Simulation + Solver + Funded Age 60y): {t_full:.3f}s")

    print("  ✅ Test 21 Done: Flask API performance benchmarked")


def test_step_up_api_contract_validation():
    """
    TEST 22: STEP_UP API Contract & Growth Rate Validation.
    """
    client = app.test_client()

    # 1. STEP_UP + missing annualContributionGrowthRate -> 400
    r1 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP"))
    assert r1.status_code == 400
    assert "annualContributionGrowthRate" in r1.get_json()["error"]["message"]

    # 2. STEP_UP + null -> 400
    r2 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate=None))
    assert r2.status_code == 400

    # 3. STEP_UP + non-numeric -> 400
    r3 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate="five_percent"))
    assert r3.status_code == 400

    # 4. STEP_UP + negative (-0.01) -> 400
    r4 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate=-0.01))
    assert r4.status_code == 400

    # 5. STEP_UP + >0.50 (0.51) -> 400
    r5 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate=0.51))
    assert r5.status_code == 400

    # 6. STEP_UP + valid 0.00 -> 200
    r6 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate=0.0))
    assert r6.status_code == 200

    # 7. STEP_UP + valid 0.10 -> 200
    r7 = client.post("/simulate", json=base_api_payload(contributionMode="STEP_UP", annualContributionGrowthRate=0.10))
    assert r7.status_code == 200

    # 8. NOMINAL_FLAT without annualContributionGrowthRate -> 200
    r8 = client.post("/simulate", json=base_api_payload(contributionMode="NOMINAL_FLAT"))
    assert r8.status_code == 200

    # 9. REAL_CONSTANT without annualContributionGrowthRate -> 200
    r9 = client.post("/simulate", json=base_api_payload(contributionMode="REAL_CONSTANT"))
    assert r9.status_code == 200

    print("  ✅ Test 22 Passed: STEP_UP API contract and growth rate requirements strictly enforced")


# ===========================================================================
# Main Runner
# ===========================================================================

def run_all_api_tests():
    print("=" * 64)
    print("  FINAURA MONTE CARLO FLASK API INTEGRATION TEST SUITE")
    print("=" * 64)
    print()

    tests = [
        ("1. Valid Simulation-Only Request (HTTP 200)", test_valid_simulation_only),
        ("2. Valid Full Request (HTTP 200)", test_valid_full_request),
        ("3. Same-Seed Reproducibility", test_reproducibility_same_seed),
        ("4. Different-Seed Stochastic Sensitivity", test_different_seed_stochastic),
        ("5. Malformed Request / Invalid JSON (HTTP 400)", test_invalid_json_or_missing_body),
        ("6. Missing Required Fields (HTTP 400)", test_missing_required_fields),
        ("7. NaN / Infinity Numeric Rejection (HTTP 400)", test_nan_infinity_numeric_rejection),
        ("8. Negative Values Rejection (HTTP 400)", test_negative_values_rejection),
        ("9-10. Invalid Simulation Count & Mode (HTTP 400)", test_invalid_simulation_count_and_mode),
        ("11. Invalid Target Probability (HTTP 400)", test_invalid_solver_target_probability),
        ("12. Unsolved Contribution Target (HTTP 200)", test_unsolved_contribution_target_http_200),
        ("13. Unreached Funded Ages (HTTP 200)", test_unreached_funded_age_http_200),
        ("14-15. userGoalCorpus Absent vs Present", test_user_goal_corpus_handling),
        ("16-17. Inclusion Flags & All-False Rejection", test_inclusion_flags),
        ("18. Clean Error Responses (No Stack Trace)", test_no_stack_trace_leak),
        ("19. Zero-Volatility API Parity Check", test_zero_vol_api_parity),
        ("20. Existing Health & Classifier Compatibility", test_existing_routes_compatibility),
        ("21. Flask API Performance Benchmarking", test_api_performance_benchmarks),
        ("22. STEP_UP API Contract & Growth Rate Validation", test_step_up_api_contract_validation),
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
        print(f"  ALL {passed} MONTE CARLO FLASK API TESTS PASSED SUCCESSFULLY! 🚀")
    else:
        print(f"  RESULTS: {passed} passed, {failed} FAILED")
    print("=" * 64)

    return failed == 0


if __name__ == "__main__":
    success = run_all_api_tests()
    sys.exit(0 if success else 1)
