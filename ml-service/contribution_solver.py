"""
ml-service/contribution_solver.py

FINAURA Monte Carlo Probabilistic Monthly-Contribution Solver — Phase 2

Pure Python + NumPy module. No Flask, no MongoDB, no ML models, no filesystem I/O.
Determines the required monthly savings contribution to achieve a target probability
of being funded at the target retirement age.

==========================================================================
FINANCIAL CONVENTIONS & MATHEMATICAL OBJECTIVE
==========================================================================

1. Primary Probability Objective:
   Find the minimum monthly contribution C such that:
     probabilityFundedAtTargetAge(C) >= targetProbability
   (Default targetProbability = 0.75 / 75%)

   NOTE: The solver optimizes for probabilityFundedAtTargetAge (funded at final
   horizon T), NOT probabilityReachedFireByTargetAge (first-crossing at any point).

2. Common Random Numbers (CRN):
   All candidate contributions during one solve invocation are evaluated against
   the EXACT SAME stochastic return shocks (same seed, same Z matrix).
   This guarantees that probabilityFundedAtTargetAge(C) is a monotonically
   non-decreasing function of C and makes bisection completely stable.

3. Short-Circuit for Already-Sufficient Users:
   If current monthly contribution already yields pCurrent >= targetProbability,
   the solver immediately returns:
     requiredMonthlyContributionRaw = currentMonthlyContribution
     recommendedMonthlyContribution = currentMonthlyContribution
     additionalMonthlyContributionRequired = 0.0

4. Dynamic Bracket Expansion:
   When current contribution is insufficient, search upper bound expands
   geometrically (upper *= 2) until p(upper) >= targetProbability or the
   technical maximum contribution ceiling (MAX_MONTHLY_CONTRIBUTION = 1e9 INR)
   is reached. Handles zero current contribution seamlessly.

5. Bisection:
   Robust bisection within [lower, upper] converges to mathematical precision
   (tolerance <= ₹1.0).

6. Product Recommendation Rounding & Verification:
   The raw mathematical contribution is rounded UP to the nearest
   recommendationIncrement (default ₹100).
   The recommended amount is then verified against the same path set to guarantee
   probabilityFundedAtTargetAge(recommended) >= targetProbability.

7. Target Separation:
   Default target is estimatedFireCorpus ("ESTIMATED_FIRE").
   Optional userGoalCorpus ("USER_GOAL") is supported independently without
   overwriting or conflating targets.
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
DEFAULT_TARGET_PROBABILITY = 0.75
DEFAULT_RECOMMENDATION_INCREMENT = 100.0  # ₹100 product recommendation step
DEFAULT_TOLERANCE = 1.0                   # ₹1.0 mathematical bisection precision
MAX_MONTHLY_CONTRIBUTION = 1_000_000_000.0  # ₹100 Crore / 1e9 INR technical ceiling
MAX_BISECTION_ITERATIONS = 100

TARGET_TYPE_ESTIMATED_FIRE = "ESTIMATED_FIRE"
TARGET_TYPE_USER_GOAL = "USER_GOAL"
VALID_TARGET_TYPES = frozenset({
    TARGET_TYPE_ESTIMATED_FIRE,
    TARGET_TYPE_USER_GOAL,
})


# ---------------------------------------------------------------------------
# Solver Input Validation
# ---------------------------------------------------------------------------
def _validate_solver_inputs(params: dict) -> None:
    """
    Validate simulation parameters plus solver-specific configuration.
    """
    # 1. Base simulation input validation
    _validate_inputs(params)

    # 2. Target probability validation (0 < targetProbability < 1)
    if "targetProbability" in params and params["targetProbability"] is not None:
        target_prob = params["targetProbability"]
        if not isinstance(target_prob, (int, float)):
            raise TypeError(f"'targetProbability' must be a number, got {type(target_prob).__name__}")
        if math.isnan(target_prob) or math.isinf(target_prob):
            raise ValueError(f"'targetProbability' must be finite, got {target_prob}")
        if target_prob <= 0.0 or target_prob >= 1.0:
            raise ValueError(f"'targetProbability' must be strictly between 0.0 and 1.0, got {target_prob}")

    # 3. Target type validation
    target_type = params.get("targetType", TARGET_TYPE_ESTIMATED_FIRE)
    if target_type not in VALID_TARGET_TYPES:
        raise ValueError(f"'targetType' must be one of {sorted(VALID_TARGET_TYPES)}, got '{target_type}'")

    if target_type == TARGET_TYPE_USER_GOAL:
        user_goal = params.get("userGoalCorpus")
        if user_goal is None or user_goal <= 0:
            raise ValueError("'userGoalCorpus' must be provided and > 0 when targetType is 'USER_GOAL'")

    # 4. Recommendation increment validation
    if "recommendationIncrement" in params and params["recommendationIncrement"] is not None:
        inc = params["recommendationIncrement"]
        if not isinstance(inc, (int, float)):
            raise TypeError(f"'recommendationIncrement' must be a number, got {type(inc).__name__}")
        if math.isnan(inc) or math.isinf(inc) or inc <= 0:
            raise ValueError(f"'recommendationIncrement' must be a positive finite number, got {inc}")

    # 5. Tolerance validation
    if "tolerance" in params and params["tolerance"] is not None:
        tol = params["tolerance"]
        if not isinstance(tol, (int, float)):
            raise TypeError(f"'tolerance' must be a number, got {type(tol).__name__}")
        if math.isnan(tol) or math.isinf(tol) or tol <= 0:
            raise ValueError(f"'tolerance' must be a positive finite number, got {tol}")


# ---------------------------------------------------------------------------
# Fast Path Evaluation under Common Random Numbers
# ---------------------------------------------------------------------------
def _evaluate_candidate_probability(
    candidate_contribution: float,
    starting_corpus: float,
    months: int,
    contribution_mode: str,
    growth_factors: np.ndarray,
    is_zero_vol: bool,
    monthly_geometric_factor: float,
    cumulative_inflation: np.ndarray,
    final_nominal_target: float,
    num_paths: int,
) -> float:
    """
    Evaluate probabilityFundedAtTargetAge for a candidate monthly contribution
    using precomputed growth factors (Common Random Numbers).

    Returns fraction of paths where final portfolio >= final_nominal_target.
    """
    portfolio = np.full(num_paths, starting_corpus, dtype=np.float64)

    for t in range(1, months + 1):
        if is_zero_vol:
            portfolio *= monthly_geometric_factor
        else:
            portfolio *= growth_factors[t - 1]

        if contribution_mode == CONTRIBUTION_MODE_NOMINAL_FLAT:
            portfolio += candidate_contribution
        else:
            portfolio += candidate_contribution * cumulative_inflation[t]

    return float(np.sum(portfolio >= final_nominal_target) / num_paths)


# ---------------------------------------------------------------------------
# Core Solver Implementation
# ---------------------------------------------------------------------------
def solve_required_contribution(params: dict) -> dict:
    """
    Solve for the required monthly contribution to reach targetProbability
    of being funded at the target retirement age.

    Parameters
    ----------
    params : dict
        Normalized forecast inputs + solver configuration:
        - startingCorpus (float >= 0)
        - monthlyContribution (float >= 0, current contribution)
        - expectedReturnRate (float > -1)
        - expectedInflationRate (float > -1)
        - portfolioVolatility (float >= 0)
        - estimatedFireCorpus (float > 0)
        - userGoalCorpus (float >= 0, optional)
        - monthsUntilRetirement (int >= 1)
        - contributionMode ("NOMINAL_FLAT" | "REAL_CONSTANT")
        - simulationCount (int >= 100)
        - seed (int)
        - targetProbability (float, 0 < p < 1, default 0.75)
        - targetType ("ESTIMATED_FIRE" | "USER_GOAL", default "ESTIMATED_FIRE")
        - recommendationIncrement (float > 0, default 100.0)
        - tolerance (float > 0, default 1.0)
        - maxMonthlyContribution (float > 0, default 1e9)

    Returns
    -------
    dict
        Structured solver result (see module docstring).
    """
    _validate_solver_inputs(params)

    # --- Unpack parameters ---
    starting_corpus = float(params["startingCorpus"])
    current_contribution = float(params["monthlyContribution"])
    annual_geometric_return = float(params["expectedReturnRate"])
    annual_inflation = float(params["expectedInflationRate"])
    annual_volatility = float(params["portfolioVolatility"])
    months = int(params["monthsUntilRetirement"])
    contribution_mode = params["contributionMode"]
    num_paths = int(params["simulationCount"])
    seed = int(params["seed"])

    target_prob = float(params.get("targetProbability", DEFAULT_TARGET_PROBABILITY))
    target_type = params.get("targetType", TARGET_TYPE_ESTIMATED_FIRE)
    rec_increment = float(params.get("recommendationIncrement", DEFAULT_RECOMMENDATION_INCREMENT))
    tolerance = float(params.get("tolerance", DEFAULT_TOLERANCE))
    max_contribution = float(params.get("maxMonthlyContribution", MAX_MONTHLY_CONTRIBUTION))

    # Determine target corpus in today's real terms
    if target_type == TARGET_TYPE_USER_GOAL:
        target_corpus_real = float(params["userGoalCorpus"])
    else:
        target_corpus_real = float(params["estimatedFireCorpus"])

    # --- Derived monthly rates and inflation schedule ---
    monthly_geometric_factor = (1.0 + annual_geometric_return) ** (1.0 / 12.0)
    sigma_monthly = annual_volatility / math.sqrt(12.0) if annual_volatility > 0 else 0.0
    monthly_inflation_factor = (1.0 + annual_inflation) ** (1.0 / 12.0)

    cumulative_inflation = np.empty(months + 1, dtype=np.float64)
    cumulative_inflation[0] = 1.0
    for t in range(1, months + 1):
        cumulative_inflation[t] = cumulative_inflation[t - 1] * monthly_inflation_factor

    # Final nominal target at horizon T
    final_nominal_target = target_corpus_real * cumulative_inflation[months]

    # --- Common Random Numbers (CRN) Precomputation ---
    is_zero_vol = (sigma_monthly == 0.0)
    if is_zero_vol:
        growth_factors = None
    else:
        rng = np.random.default_rng(seed)
        z_matrix = rng.standard_normal((months, num_paths))
        growth_factors = monthly_geometric_factor * np.exp(sigma_monthly * z_matrix)

    def evaluate(c: float) -> float:
        return _evaluate_candidate_probability(
            candidate_contribution=c,
            starting_corpus=starting_corpus,
            months=months,
            contribution_mode=contribution_mode,
            growth_factors=growth_factors,
            is_zero_vol=is_zero_vol,
            monthly_geometric_factor=monthly_geometric_factor,
            cumulative_inflation=cumulative_inflation,
            final_nominal_target=final_nominal_target,
            num_paths=num_paths,
        )

    # --- Step 1: Evaluate Current Monthly Contribution ---
    p_current = evaluate(current_contribution)

    # Short-circuit if current contribution is already on track
    if p_current >= target_prob:
        return {
            "solved": True,
            "targetProbability": target_prob,
            "targetType": target_type,
            "currentMonthlyContribution": current_contribution,
            "currentProbabilityFunded": p_current,
            "requiredMonthlyContributionRaw": current_contribution,
            "recommendedMonthlyContribution": current_contribution,
            "additionalMonthlyContributionRequired": 0.0,
            "achievedProbabilityFunded": p_current,
            "recommendationIncrement": rec_increment,
            "iterations": 0,
            "bracketExpansions": 0,
            "simulationCount": num_paths,
            "seed": seed,
            "monthsSimulated": months,
            "contributionMode": contribution_mode,
        }

    # --- Step 2: Dynamic Bracket Expansion ---
    lower = current_contribution
    p_lower = p_current

    # Starting upper bound: at least ₹10,000 or 2x current
    upper = max(10_000.0, current_contribution * 2.0, rec_increment)
    p_upper = evaluate(upper)
    bracket_expansions = 0

    while p_upper < target_prob:
        if upper >= max_contribution:
            # Reached technical ceiling without meeting targetProbability
            return {
                "solved": False,
                "reason": "TARGET_PROBABILITY_NOT_REACHED_WITHIN_SEARCH_LIMIT",
                "targetProbability": target_prob,
                "targetType": target_type,
                "currentMonthlyContribution": current_contribution,
                "currentProbabilityFunded": p_current,
                "maximumContributionTested": upper,
                "maximumProbabilityAchieved": p_upper,
                "recommendationIncrement": rec_increment,
                "iterations": 0,
                "bracketExpansions": bracket_expansions,
                "simulationCount": num_paths,
                "seed": seed,
                "monthsSimulated": months,
                "contributionMode": contribution_mode,
            }

        lower = upper
        p_lower = p_upper
        upper = min(upper * 2.0, max_contribution)
        bracket_expansions += 1
        p_upper = evaluate(upper)

    # --- Step 3: Bisection Search ---
    # Invariant: p_lower < target_prob and p_upper >= target_prob
    iterations = 0
    while (upper - lower) > tolerance and iterations < MAX_BISECTION_ITERATIONS:
        mid = (lower + upper) / 2.0
        p_mid = evaluate(mid)
        iterations += 1

        if p_mid >= target_prob:
            upper = mid
            p_upper = p_mid
        else:
            lower = mid
            p_lower = p_mid

    # Upper bound is guaranteed to satisfy p(upper) >= target_prob
    raw_required = upper

    # --- Step 4: Product Recommendation Rounding & Verification ---
    # Round UP to nearest recommendation increment (e.g. ₹100)
    recommended = math.ceil(raw_required / rec_increment) * rec_increment
    p_rec = evaluate(recommended)

    # Verification loop (safety against edge-case numerical tolerances)
    while p_rec < target_prob and recommended < max_contribution:
        recommended += rec_increment
        p_rec = evaluate(recommended)

    if p_rec < target_prob:
        return {
            "solved": False,
            "reason": "TARGET_PROBABILITY_NOT_REACHED_AFTER_ROUNDING",
            "targetProbability": target_prob,
            "targetType": target_type,
            "currentMonthlyContribution": current_contribution,
            "currentProbabilityFunded": p_current,
            "maximumContributionTested": recommended,
            "maximumProbabilityAchieved": p_rec,
            "recommendationIncrement": rec_increment,
            "iterations": iterations,
            "bracketExpansions": bracket_expansions,
            "simulationCount": num_paths,
            "seed": seed,
            "monthsSimulated": months,
            "contributionMode": contribution_mode,
        }

    additional_required = max(0.0, recommended - current_contribution)

    return {
        "solved": True,
        "targetProbability": target_prob,
        "targetType": target_type,
        "currentMonthlyContribution": current_contribution,
        "currentProbabilityFunded": p_current,
        "requiredMonthlyContributionRaw": float(raw_required),
        "recommendedMonthlyContribution": float(recommended),
        "additionalMonthlyContributionRequired": float(additional_required),
        "achievedProbabilityFunded": float(p_rec),
        "recommendationIncrement": rec_increment,
        "iterations": iterations,
        "bracketExpansions": bracket_expansions,
        "simulationCount": num_paths,
        "seed": seed,
        "monthsSimulated": months,
        "contributionMode": contribution_mode,
    }
