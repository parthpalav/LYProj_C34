"""
ml-service/monte_carlo.py

FINAURA Monte Carlo Simulation Engine — Phase 1 (Pure Core)

Pure Python + NumPy module. No Flask, no MongoDB, no ML models, no filesystem I/O.
Accepts normalized numeric inputs, returns probability/distribution outputs.

==========================================================================
FINANCIAL CONVENTIONS (must match server/utils/financialMath.js exactly)
==========================================================================

1. expectedReturnRate is a NOMINAL GEOMETRIC/COMPOUNDING annual expectation.

2. Effective monthly rate from annual rate (EAR → EMR):
     r_monthly = (1 + r_annual)^(1/12) - 1

3. Fisher real return:
     r_real = (1 + r_nominal) / (1 + r_inflation) - 1

4. Contribution timing: End-of-Month (Ordinary Annuity).

5. Default contribution mode: NOMINAL_FLAT
   - User contributes fixed nominal INR each month.
   - Real purchasing power of contribution deflates over time.

6. REAL_CONSTANT mode:
   - User contributes constant real purchasing power.
   - Nominal contribution escalates with inflation.

7. FIRE corpus (estimatedFireCorpus) is expressed in TODAY'S REAL RUPEES.

8. userGoalCorpus and estimatedFireCorpus are SEPARATE targets.

==========================================================================
STOCHASTIC RETURN PROCESS — MEDIAN-ANCHORED GBM
==========================================================================

FINAURA's expectedReturnRate is already the nominal geometric/compounding
expectation. The stochastic process is parameterized so that:

  - The MEDIAN (geometric mean) path reproduces the deterministic
    compounding trajectory.
  - The zero-shock (Z=0) path exactly equals the deterministic Base path.

Define:
  annualGeometricReturn = expectedReturnRate
  monthlyGeometricFactor = (1 + annualGeometricReturn)^(1/12)
  sigmaMonthly = portfolioVolatility / sqrt(12)

For each month t, each path i:
  Z_{t,i} ~ N(0, 1)

  logGrowthFactor = log(monthlyGeometricFactor) + sigmaMonthly * Z_{t,i}
  growthFactor    = exp(logGrowthFactor)

Equivalently:
  growthFactor = monthlyGeometricFactor * exp(sigmaMonthly * Z_{t,i})

Properties:
  Z = 0   → growthFactor = monthlyGeometricFactor  (exactly deterministic)
  Median  → monthlyGeometricFactor                  (geometric mean anchor)
  E[growthFactor] = monthlyGeometricFactor * exp(0.5 * sigmaMonthly^2)
                  > monthlyGeometricFactor           (arithmetic mean > geometric)

The arithmetic expected growth factor exceeds the deterministic return.
This is intentional and mathematically correct for lognormal returns.
The user's expectedReturnRate defines the GEOMETRIC compounding expectation,
not the arithmetic average of stochastic returns.

==========================================================================
INFLATION — DETERMINISTIC (V1 FROZEN)
==========================================================================

Inflation is applied deterministically each month:
  inflationFactorMonthly = (1 + expectedInflationRate)^(1/12)
  cumulativeInflation[t] = (1 + expectedInflationRate)^(t/12)

No stochastic inflation in Phase 1.

==========================================================================
SIMULATION COORDINATE SYSTEM — NOMINAL
==========================================================================

Portfolio is tracked in NOMINAL INR throughout.
FIRE targets are inflated to nominal at each month for crossing checks:
  nominalFireTarget[t] = estimatedFireCorpus * cumulativeInflation[t]

Final corpus percentiles are deflated back to today's real rupees
for reporting, making them directly comparable to estimatedFireCorpus.

==========================================================================
CONTRIBUTION MODES
==========================================================================

NOMINAL_FLAT (default):
  contribution[t] = monthlyContribution  (constant nominal INR)

REAL_CONSTANT:
  contribution[t] = monthlyContribution * cumulativeInflation[t]
  (contribution escalates nominally to maintain real purchasing power)

Contribution occurs at END OF MONTH (ordinary annuity).
"""

import numpy as np
import math

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CONTRIBUTION_MODE_NOMINAL_FLAT = "NOMINAL_FLAT"
CONTRIBUTION_MODE_REAL_CONSTANT = "REAL_CONSTANT"
VALID_CONTRIBUTION_MODES = frozenset({
    CONTRIBUTION_MODE_NOMINAL_FLAT,
    CONTRIBUTION_MODE_REAL_CONSTANT,
})

MIN_SIMULATION_COUNT = 100
MAX_SIMULATION_COUNT = 100_000
MAX_MONTHS = 1200  # 100 years, matches financialRules.js


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------
def _validate_inputs(params: dict) -> None:
    """
    Strictly validate all simulation inputs.
    Rejects NaN, Infinity, negative values where inappropriate,
    and structurally invalid payloads.
    """
    required_fields = [
        "startingCorpus",
        "monthlyContribution",
        "expectedReturnRate",
        "expectedInflationRate",
        "portfolioVolatility",
        "estimatedFireCorpus",
        "monthsUntilRetirement",
        "contributionMode",
        "simulationCount",
        "seed",
    ]

    for field in required_fields:
        if field not in params:
            raise ValueError(f"Missing required field: '{field}'")

    def _check_finite(value, name):
        if not isinstance(value, (int, float)):
            raise TypeError(f"'{name}' must be a number, got {type(value).__name__}")
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"'{name}' must be finite, got {value}")

    def _check_non_negative_finite(value, name):
        _check_finite(value, name)
        if value < 0:
            raise ValueError(f"'{name}' must be non-negative, got {value}")

    # Currency values
    _check_non_negative_finite(params["startingCorpus"], "startingCorpus")
    _check_non_negative_finite(params["monthlyContribution"], "monthlyContribution")

    # Rates
    _check_finite(params["expectedReturnRate"], "expectedReturnRate")
    if params["expectedReturnRate"] <= -1:
        raise ValueError("'expectedReturnRate' must be > -1.0 (-100%)")

    _check_finite(params["expectedInflationRate"], "expectedInflationRate")
    if params["expectedInflationRate"] <= -1:
        raise ValueError("'expectedInflationRate' must be > -1.0 (-100%)")

    # Volatility
    _check_non_negative_finite(params["portfolioVolatility"], "portfolioVolatility")

    # FIRE target
    _check_finite(params["estimatedFireCorpus"], "estimatedFireCorpus")
    if params["estimatedFireCorpus"] <= 0:
        raise ValueError("'estimatedFireCorpus' must be > 0")

    # Horizon
    months = params["monthsUntilRetirement"]
    if not isinstance(months, int) or months < 1 or months > MAX_MONTHS:
        raise ValueError(
            f"'monthsUntilRetirement' must be an integer in [1, {MAX_MONTHS}], got {months}"
        )

    # Contribution mode
    mode = params["contributionMode"]
    if mode not in VALID_CONTRIBUTION_MODES:
        raise ValueError(
            f"'contributionMode' must be one of {sorted(VALID_CONTRIBUTION_MODES)}, got '{mode}'"
        )

    # Simulation count
    sim_count = params["simulationCount"]
    if not isinstance(sim_count, int):
        raise TypeError(f"'simulationCount' must be an integer, got {type(sim_count).__name__}")
    if sim_count < MIN_SIMULATION_COUNT or sim_count > MAX_SIMULATION_COUNT:
        raise ValueError(
            f"'simulationCount' must be in [{MIN_SIMULATION_COUNT}, {MAX_SIMULATION_COUNT}], got {sim_count}"
        )

    # Seed
    seed = params["seed"]
    if not isinstance(seed, int):
        raise TypeError(f"'seed' must be an integer, got {type(seed).__name__}")

    # Optional userGoalCorpus
    if "userGoalCorpus" in params and params["userGoalCorpus"] is not None:
        _check_non_negative_finite(params["userGoalCorpus"], "userGoalCorpus")


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------
def run_simulation(params: dict) -> dict:
    """
    Execute Monte Carlo simulation of portfolio accumulation paths.

    Parameters
    ----------
    params : dict
        Normalized numeric input payload. See module docstring for schema.

    Returns
    -------
    dict
        Probability metrics, corpus percentiles, first-crossing data,
        optional user-goal metrics, central-path reference values.
    """
    _validate_inputs(params)

    # --- Unpack inputs ---
    starting_corpus = float(params["startingCorpus"])
    monthly_contribution = float(params["monthlyContribution"])
    annual_geometric_return = float(params["expectedReturnRate"])
    annual_inflation = float(params["expectedInflationRate"])
    annual_volatility = float(params["portfolioVolatility"])
    estimated_fire_corpus = float(params["estimatedFireCorpus"])
    months = int(params["monthsUntilRetirement"])
    contribution_mode = params["contributionMode"]
    num_paths = int(params["simulationCount"])
    seed = int(params["seed"])

    user_goal_corpus = None
    if "userGoalCorpus" in params and params["userGoalCorpus"] is not None:
        user_goal_corpus = float(params["userGoalCorpus"])
        if user_goal_corpus <= 0:
            user_goal_corpus = None

    # --- Derived monthly parameters ---
    # FINAURA convention: EAR to EMR
    monthly_geometric_factor = (1.0 + annual_geometric_return) ** (1.0 / 12.0)

    # Monthly volatility via sqrt(12) scaling
    sigma_monthly = annual_volatility / math.sqrt(12.0) if annual_volatility > 0 else 0.0

    # Deterministic monthly inflation factor
    monthly_inflation_factor = (1.0 + annual_inflation) ** (1.0 / 12.0)

    # --- Precompute cumulative inflation schedule ---
    # cumulative_inflation[t] = (1 + annual_inflation)^(t/12) for t = 0..months
    # Used for: nominal FIRE target, REAL_CONSTANT contribution escalation, deflation
    cumulative_inflation = np.empty(months + 1, dtype=np.float64)
    cumulative_inflation[0] = 1.0
    for t in range(1, months + 1):
        cumulative_inflation[t] = cumulative_inflation[t - 1] * monthly_inflation_factor

    # --- Nominal FIRE target at each month ---
    # nominalFireTarget[t] = estimatedFireCorpus * cumulativeInflation[t]
    nominal_fire_targets = estimated_fire_corpus * cumulative_inflation

    # Nominal user goal targets (if provided)
    nominal_goal_targets = None
    if user_goal_corpus is not None:
        nominal_goal_targets = user_goal_corpus * cumulative_inflation

    # --- Initialize RNG ---
    rng = np.random.default_rng(seed)

    # --- Initialize path state ---
    # portfolio[i] = current nominal portfolio value for path i
    portfolio = np.full(num_paths, starting_corpus, dtype=np.float64)

    # --- t=0 crossing detection ---
    # Check FIRE funding at t=0 BEFORE the simulation loop
    fire_first_crossing = np.full(num_paths, -1, dtype=np.int32)  # -1 = never crossed
    fire_ever_crossed = np.zeros(num_paths, dtype=np.bool_)

    if starting_corpus >= nominal_fire_targets[0]:
        fire_first_crossing[:] = 0
        fire_ever_crossed[:] = True

    # User goal t=0 crossing
    goal_first_crossing = None
    goal_ever_crossed = None
    if user_goal_corpus is not None:
        goal_first_crossing = np.full(num_paths, -1, dtype=np.int32)
        goal_ever_crossed = np.zeros(num_paths, dtype=np.bool_)

        if starting_corpus >= nominal_goal_targets[0]:
            goal_first_crossing[:] = 0
            goal_ever_crossed[:] = True

    # --- Monthly simulation loop (vectorized across paths) ---
    for t in range(1, months + 1):
        # 1. Stochastic nominal return
        if sigma_monthly > 0:
            # Median-anchored GBM:
            # growthFactor = monthlyGeometricFactor * exp(sigmaMonthly * Z)
            z = rng.standard_normal(num_paths)
            growth_factors = monthly_geometric_factor * np.exp(sigma_monthly * z)
        else:
            # Deterministic: all paths grow by the geometric factor
            growth_factors = monthly_geometric_factor

        portfolio *= growth_factors

        # 2. End-of-month contribution
        if contribution_mode == CONTRIBUTION_MODE_NOMINAL_FLAT:
            # Constant nominal INR
            portfolio += monthly_contribution
        else:
            # REAL_CONSTANT: escalate nominally with inflation
            portfolio += monthly_contribution * cumulative_inflation[t]

        # 3. FIRE crossing check (only for paths that haven't crossed yet)
        not_yet_crossed_fire = ~fire_ever_crossed
        if np.any(not_yet_crossed_fire):
            newly_crossed = not_yet_crossed_fire & (portfolio >= nominal_fire_targets[t])
            fire_first_crossing[newly_crossed] = t
            fire_ever_crossed[newly_crossed] = True

        # 4. User goal crossing check
        if user_goal_corpus is not None:
            not_yet_crossed_goal = ~goal_ever_crossed
            if np.any(not_yet_crossed_goal):
                newly_crossed_goal = not_yet_crossed_goal & (
                    portfolio >= nominal_goal_targets[t]
                )
                goal_first_crossing[newly_crossed_goal] = t
                goal_ever_crossed[newly_crossed_goal] = True

    # --- Post-simulation analysis ---

    # Final nominal portfolio values
    final_nominal = portfolio.copy()

    # Final FIRE target in nominal terms
    final_nominal_fire_target = nominal_fire_targets[months]

    # PRIMARY METRIC: probabilityFundedAtTargetAge
    # Fraction of paths where final portfolio >= nominal FIRE target at horizon
    funded_at_target = np.sum(final_nominal >= final_nominal_fire_target) / num_paths

    # SECONDARY METRIC: probabilityReachedFireByTargetAge
    # Fraction of paths that ever crossed the nominal FIRE target
    reached_fire = np.sum(fire_ever_crossed) / num_paths

    # Corpus percentiles in TODAY'S REAL RUPEES (deflated)
    final_real = final_nominal / cumulative_inflation[months]
    p10, p25, p50, p75, p90 = np.percentile(final_real, [10, 25, 50, 75, 90])

    # Enforce monotonicity (numerical safety for identical-value edge cases)
    assert p10 <= p25 <= p50 <= p75 <= p90, (
        f"Percentile ordering violated: {p10}, {p25}, {p50}, {p75}, {p90}"
    )

    # First-crossing statistics (FIRE)
    crossed_mask = fire_first_crossing >= 0
    percent_crossed = float(np.sum(crossed_mask)) / num_paths

    crossing_months = fire_first_crossing[crossed_mask]
    if len(crossing_months) > 0:
        fc_p25 = int(np.percentile(crossing_months, 25))
        fc_p50 = int(np.percentile(crossing_months, 50))
        fc_p75 = int(np.percentile(crossing_months, 75))
    else:
        fc_p25 = fc_p50 = fc_p75 = None

    first_crossing_result = {
        "percentCrossed": percent_crossed,
        "p25Month": fc_p25,
        "p50Month": fc_p50,
        "p75Month": fc_p75,
    }

    # User goal metrics (from same path set, NO resimulation)
    user_goal_result = None
    if user_goal_corpus is not None:
        final_nominal_goal_target = nominal_goal_targets[months]
        goal_funded_at_target = float(
            np.sum(final_nominal >= final_nominal_goal_target)
        ) / num_paths
        goal_reached = float(np.sum(goal_ever_crossed)) / num_paths

        user_goal_result = {
            "probabilityFundedAtTargetAge": goal_funded_at_target,
            "probabilityReachedByTargetAge": goal_reached,
        }

    # Central path (deterministic reference — the zero-shock trajectory)
    central_nominal = starting_corpus
    for t in range(1, months + 1):
        central_nominal *= monthly_geometric_factor
        if contribution_mode == CONTRIBUTION_MODE_NOMINAL_FLAT:
            central_nominal += monthly_contribution
        else:
            central_nominal += monthly_contribution * cumulative_inflation[t]
    central_real = central_nominal / cumulative_inflation[months]

    return {
        "probabilityFundedAtTargetAge": float(funded_at_target),
        "probabilityReachedFireByTargetAge": float(reached_fire),
        "corpusPercentiles": {
            "p10": float(p10),
            "p25": float(p25),
            "p50": float(p50),
            "p75": float(p75),
            "p90": float(p90),
        },
        "firstCrossing": first_crossing_result,
        "userGoal": user_goal_result,
        "centralPath": {
            "finalCorpusNominal": float(central_nominal),
            "finalCorpusReal": float(central_real),
        },
        "simulationCount": num_paths,
        "seed": seed,
        "monthsSimulated": months,
        "contributionMode": contribution_mode,
    }
