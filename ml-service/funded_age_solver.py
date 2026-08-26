"""
ml-service/funded_age_solver.py

FINAURA Monte Carlo Probabilistic Funded-Age Solver — Phase 3

Pure Python + NumPy module. No Flask, no MongoDB, no ML models, no filesystem I/O.
Determines probabilistic funded ages (e.g., fundedAge50, fundedAge75) representing
the earliest age at which the user achieves a sustained target funding probability.

==========================================================================
FUNDED-AGE SEMANTICS & SUSTAINED BACKWARD-SCAN ALGORITHM
==========================================================================

1. Exact Definition:
   fundedAgeX is the earliest age (in integer months) at which:
     P(portfolio at that age >= FIRE target at that age) >= X
   SUSTAINED through the end of the search horizon.

   Formally:
     fundedAgeX = earliest month t such that min(probability[t : horizon]) >= X

2. Why Sustained (Backward Scan):
   Due to market volatility, inflation drag, or nominal flat contribution erosion,
   empirical funding probability may cross above a threshold (e.g. 51% at age 48)
   and temporarily dip below it later (e.g. 47% at age 49).
   A naive first-crossing definition would prematurely report age 48.
   The backward scan starts from the horizon end and finds the earliest month from
   which the funding probability remains continuously at or above the threshold.

3. Simulate Once Across Horizon:
   Monte Carlo paths are evolved once across the entire search horizon (t = 0 to M).
   Monthly funding probabilities are computed on the same path matrix, ensuring
   strict common random numbers, statistical consistency, and O(M * N) complexity.

4. Separation from Phase 1 First-Crossing:
   Phase 1 firstCrossing (p25Month, p50Month, p75Month) records path-level first
   touch of the target.
   Phase 3 fundedAge50/fundedAge75 answers population-level sustained funding probability.
"""

import math
import numpy as np

from monte_carlo import (
    CONTRIBUTION_MODE_NOMINAL_FLAT,
    CONTRIBUTION_MODE_REAL_CONSTANT,
    VALID_CONTRIBUTION_MODES,
    MIN_SIMULATION_COUNT,
    MAX_SIMULATION_COUNT,
    MAX_MONTHS,
    _validate_inputs,
)

# ---------------------------------------------------------------------------
# Solver Constants
# ---------------------------------------------------------------------------
DEFAULT_PROBABILITY_THRESHOLDS = (0.50, 0.75)
DEFAULT_MAX_SEARCH_AGE = 90.0
HARD_MAX_SEARCH_AGE = 120.0


# ---------------------------------------------------------------------------
# Sustained Backward-Scan Helper
# ---------------------------------------------------------------------------
def find_earliest_sustained_month(
    probabilities: np.ndarray,
    threshold: float,
    start_month: int = 0
) -> tuple[bool, int | None, float | None]:
    """
    Find the earliest month index t >= start_month such that
    probabilities[s] >= threshold for all s from t to len(probabilities) - 1.

    Parameters
    ----------
    probabilities : np.ndarray
        1D array of funding probabilities for months t = 0..M.
    threshold : float
        Target probability threshold (0 < threshold < 1).
    start_month : int
        Earliest month to consider (default 0).

    Returns
    -------
    tuple[bool, int | None, float | None]
        (reached, month_index, probability_at_month)
    """
    n = len(probabilities)
    if n == 0 or start_month >= n:
        return False, None, None

    # If the horizon endpoint does not meet the threshold, it is never sustained
    if probabilities[-1] < threshold:
        return False, None, None

    # Scan backward from the end of the horizon
    t = n - 1
    while t > start_month and probabilities[t - 1] >= threshold:
        t -= 1

    return True, t, float(probabilities[t])


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def _validate_funded_age_inputs(params: dict) -> None:
    """
    Strictly validate inputs for the funded-age solver.
    """
    # 1. Base simulation parameters validation (reusing monte_carlo.py)
    # Check if monthsUntilRetirement is in params; if not, we can provide a dummy for base validation
    validation_copy = params.copy()
    if "monthsUntilRetirement" not in validation_copy:
        validation_copy["monthsUntilRetirement"] = 120  # dummy for base validator
    _validate_inputs(validation_copy)

    def _check_finite_number(value, name):
        if not isinstance(value, (int, float)):
            raise TypeError(f"'{name}' must be a number, got {type(value).__name__}")
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"'{name}' must be finite, got {value}")

    # 2. currentAge validation
    if "currentAge" not in params:
        raise ValueError("Missing required field: 'currentAge'")
    current_age = params["currentAge"]
    _check_finite_number(current_age, "currentAge")
    if current_age < 0 or current_age > HARD_MAX_SEARCH_AGE:
        raise ValueError(f"'currentAge' must be in [0, {HARD_MAX_SEARCH_AGE}], got {current_age}")

    # 3. searchStartAge validation
    search_start_age = params.get("searchStartAge", current_age)
    _check_finite_number(search_start_age, "searchStartAge")
    if search_start_age < current_age:
        raise ValueError(f"'searchStartAge' ({search_start_age}) cannot be less than 'currentAge' ({current_age})")

    # 4. maxSearchAge validation
    max_search_age = params.get("maxSearchAge", max(current_age + 60.0, DEFAULT_MAX_SEARCH_AGE))
    _check_finite_number(max_search_age, "maxSearchAge")
    if max_search_age <= search_start_age:
        raise ValueError(f"'maxSearchAge' ({max_search_age}) must be strictly greater than 'searchStartAge' ({search_start_age})")
    if max_search_age > HARD_MAX_SEARCH_AGE:
        raise ValueError(f"'maxSearchAge' must be <= {HARD_MAX_SEARCH_AGE}, got {max_search_age}")

    total_months = int(round((max_search_age - current_age) * 12))
    if total_months < 1 or total_months > MAX_MONTHS:
        raise ValueError(f"Total search months ({total_months}) must be in [1, {MAX_MONTHS}]")

    # 5. probabilityThresholds validation
    thresholds = params.get("probabilityThresholds", DEFAULT_PROBABILITY_THRESHOLDS)
    if not isinstance(thresholds, (list, tuple, np.ndarray)) or len(thresholds) == 0:
        raise ValueError("'probabilityThresholds' must be a non-empty list/tuple of numbers")

    for th in thresholds:
        _check_finite_number(th, "threshold")
        if th <= 0.0 or th >= 1.0:
            raise ValueError(f"Each probability threshold must be strictly between 0.0 and 1.0, got {th}")


# ---------------------------------------------------------------------------
# Core Solver Implementation
# ---------------------------------------------------------------------------
def solve_funded_ages(params: dict) -> dict:
    """
    Solve for probabilistic funded ages (e.g. fundedAge50, fundedAge75)
    under sustained backward-scan semantics.

    Parameters
    ----------
    params : dict
        - startingCorpus (float >= 0)
        - monthlyContribution (float >= 0)
        - expectedReturnRate (float > -1.0)
        - expectedInflationRate (float > -1.0)
        - portfolioVolatility (float >= 0)
        - estimatedFireCorpus (float > 0)
        - userGoalCorpus (float >= 0, optional)
        - contributionMode ("NOMINAL_FLAT" | "REAL_CONSTANT")
        - simulationCount (int >= 100)
        - seed (int)
        - currentAge (float >= 0)
        - searchStartAge (float >= currentAge, optional)
        - maxSearchAge (float > searchStartAge, optional)
        - probabilityThresholds (list[float], optional, default [0.50, 0.75])

    Returns
    -------
    dict
        Structured funded-age metrics and diagnostic horizon statistics.
    """
    _validate_funded_age_inputs(params)

    # --- Unpack parameters ---
    starting_corpus = float(params["startingCorpus"])
    monthly_contribution = float(params["monthlyContribution"])
    annual_geometric_return = float(params["expectedReturnRate"])
    annual_inflation = float(params["expectedInflationRate"])
    annual_volatility = float(params["portfolioVolatility"])
    estimated_fire_corpus = float(params["estimatedFireCorpus"])
    contribution_mode = params["contributionMode"]
    num_paths = int(params["simulationCount"])
    seed = int(params["seed"])

    current_age = float(params["currentAge"])
    search_start_age = float(params.get("searchStartAge", current_age))
    default_max_age = max(current_age + 60.0, DEFAULT_MAX_SEARCH_AGE)
    max_search_age = float(params.get("maxSearchAge", default_max_age))
    thresholds = [float(th) for th in params.get("probabilityThresholds", DEFAULT_PROBABILITY_THRESHOLDS)]

    user_goal_corpus = None
    if "userGoalCorpus" in params and params["userGoalCorpus"] is not None:
        user_goal_corpus = float(params["userGoalCorpus"])
        if user_goal_corpus <= 0:
            user_goal_corpus = None

    # --- Grid parameters ---
    total_months = int(round((max_search_age - current_age) * 12))
    start_month = max(0, int(round((search_start_age - current_age) * 12)))

    # --- Monthly rates and inflation schedule ---
    monthly_geometric_factor = (1.0 + annual_geometric_return) ** (1.0 / 12.0)
    sigma_monthly = annual_volatility / math.sqrt(12.0) if annual_volatility > 0 else 0.0
    monthly_inflation_factor = (1.0 + annual_inflation) ** (1.0 / 12.0)

    cumulative_inflation = np.empty(total_months + 1, dtype=np.float64)
    cumulative_inflation[0] = 1.0
    for t in range(1, total_months + 1):
        cumulative_inflation[t] = cumulative_inflation[t - 1] * monthly_inflation_factor

    # --- Precompute nominal contribution schedule ---
    annual_growth_rate = float(params.get("annualContributionGrowthRate", 0.0)) if contribution_mode == "STEP_UP" else 0.0
    contribution_schedule = np.empty(total_months + 1, dtype=np.float64)
    contribution_schedule[0] = 0.0
    for t in range(1, total_months + 1):
        if contribution_mode == "NOMINAL_FLAT":
            contribution_schedule[t] = monthly_contribution
        elif contribution_mode == "REAL_CONSTANT":
            contribution_schedule[t] = monthly_contribution * cumulative_inflation[t]
        elif contribution_mode == "STEP_UP":
            year_idx = (t - 1) // 12
            contribution_schedule[t] = monthly_contribution * ((1.0 + annual_growth_rate) ** year_idx)

    # Nominal target schedules
    nominal_fire_targets = estimated_fire_corpus * cumulative_inflation
    nominal_goal_targets = user_goal_corpus * cumulative_inflation if user_goal_corpus is not None else None

    # --- Stochastic Growth Factors (Simulate Once) ---
    is_zero_vol = (sigma_monthly == 0.0)
    if is_zero_vol:
        growth_factors = None
    else:
        rng = np.random.default_rng(seed)
        z_matrix = rng.standard_normal((total_months, num_paths))
        growth_factors = monthly_geometric_factor * np.exp(sigma_monthly * z_matrix)

    # --- Path Evolution & Monthly Probability Accumulation ---
    portfolio = np.full(num_paths, starting_corpus, dtype=np.float64)

    fire_probabilities = np.empty(total_months + 1, dtype=np.float64)
    fire_probabilities[0] = float(np.sum(portfolio >= nominal_fire_targets[0]) / num_paths)

    goal_probabilities = np.empty(total_months + 1, dtype=np.float64) if user_goal_corpus is not None else None
    if goal_probabilities is not None:
        goal_probabilities[0] = float(np.sum(portfolio >= nominal_goal_targets[0]) / num_paths)

    for t in range(1, total_months + 1):
        if is_zero_vol:
            portfolio *= monthly_geometric_factor
        else:
            portfolio *= growth_factors[t - 1]

        portfolio += contribution_schedule[t]

        fire_probabilities[t] = float(np.sum(portfolio >= nominal_fire_targets[t]) / num_paths)

        if goal_probabilities is not None:
            goal_probabilities[t] = float(np.sum(portfolio >= nominal_goal_targets[t]) / num_paths)

    # --- Backward-Scan Threshold Evaluation ---
    def build_threshold_result(probs_array: np.ndarray, th: float) -> dict:
        reached, month_idx, prob_at_age = find_earliest_sustained_month(
            probabilities=probs_array,
            threshold=th,
            start_month=start_month
        )
        if reached:
            age_years = current_age + (month_idx / 12.0)
            return {
                "reached": True,
                "ageYears": float(round(age_years, 4)),
                "monthsFromNow": int(month_idx),
                "probabilityAtAge": float(prob_at_age),
            }
        else:
            return {
                "reached": False,
                "ageYears": None,
                "monthsFromNow": None,
                "probabilityAtAge": None,
            }

    # Evaluate all requested thresholds for FIRE target
    funded_ages_map = {}
    for th in thresholds:
        key_name = f"fundedAge{int(round(th * 100))}"
        funded_ages_map[key_name] = build_threshold_result(fire_probabilities, th)

    # User goal evaluations if applicable
    user_goal_funded_ages_map = None
    if goal_probabilities is not None:
        user_goal_funded_ages_map = {}
        for th in thresholds:
            key_name = f"fundedAge{int(round(th * 100))}"
            user_goal_funded_ages_map[key_name] = build_threshold_result(goal_probabilities, th)

    # Primary convenience top-level fields for fundedAge50 and fundedAge75
    fa50 = funded_ages_map.get("fundedAge50", build_threshold_result(fire_probabilities, 0.50))
    fa75 = funded_ages_map.get("fundedAge75", build_threshold_result(fire_probabilities, 0.75))

    ug_fa50 = None
    ug_fa75 = None
    if user_goal_funded_ages_map is not None:
        ug_fa50 = user_goal_funded_ages_map.get("fundedAge50", build_threshold_result(goal_probabilities, 0.50))
        ug_fa75 = user_goal_funded_ages_map.get("fundedAge75", build_threshold_result(goal_probabilities, 0.75))

    return {
        "targetType": "ESTIMATED_FIRE",
        "currentAge": current_age,
        "searchStartAge": search_start_age,
        "maxSearchAge": max_search_age,
        "monthsSimulated": total_months,
        "simulationCount": num_paths,
        "seed": seed,
        "contributionMode": contribution_mode,
        "fundedAges": funded_ages_map,
        "fundedAge50": fa50,
        "fundedAge75": fa75,
        "userGoalFundedAges": user_goal_funded_ages_map,
        "userGoalFundedAge50": ug_fa50,
        "userGoalFundedAge75": ug_fa75,
    }
