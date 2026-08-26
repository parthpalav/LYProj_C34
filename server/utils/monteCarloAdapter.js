import crypto from 'node:crypto';
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_PORTFOLIO_VOLATILITY,
  DEFAULT_SIMULATION_COUNT,
  DEFAULT_SOLVER_TARGET_PROBABILITY,
  MONTE_CARLO_ENGINE_VERSION,
  VOLATILITY_INTERCEPT,
  VOLATILITY_SLOPE,
  VOLATILITY_MIN,
  VOLATILITY_MAX,
  FEASIBILITY_STATUS,
  FEASIBILITY_THRESHOLDS,
  DEFAULT_ALTERNATIVE_AGE_OFFSETS,
  MAX_RETIREMENT_ALTERNATIVE_AGE
} from '../config/financialRules.js';
import { logger } from './logger.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * server/utils/monteCarloAdapter.js
 * 
 * Production adapter between Node PredictabilityService and Python Monte Carlo Engine.
 * Responsibilities:
 *  - Derive portfolio volatility from frozen V1 policy: clamp(-0.04 + 2 * returnRate, 0.06, 0.22)
 *  - Deterministic canonical seed derivation (SHA-256)
 *  - Normalize inputs into exact Flask POST /simulate payload contract
 *  - Internal HTTP client with timeout and graceful fallback
 *  - Untrusted Python response validation
 *  - Public additive probabilistic response mapping with PORTFOLIO_RISK_ESTIMATED warning
 */

/**
 * Derive portfolio volatility based on frozen V1 financial policy:
 *   sigmaAnnual = clamp(-0.04 + 2.0 * expectedReturnRate, 0.06, 0.22)
 * 
 * Invariants:
 *  - Zero authority given to user.portfolioVolatility, options.portfolioVolatility, or riskProfile.
 *  - Invalid or missing return rate falls back to DEFAULT_RETURN_RATE (0.08) -> sigma = 0.12.
 *  - Returns { portfolioVolatility, effectiveExpectedReturnRate, volatilitySource }.
 * 
 * @param {number} [expectedReturnRate] - Annual geometric return rate as decimal (e.g. 0.08)
 * @returns {{ portfolioVolatility: number, effectiveExpectedReturnRate: number, volatilitySource: string }}
 */
export function derivePortfolioVolatility(expectedReturnRate) {
  let effectiveReturn = expectedReturnRate;
  let volatilitySource = 'RETURN_DERIVED';

  if (
    effectiveReturn === null ||
    effectiveReturn === undefined ||
    typeof effectiveReturn !== 'number' ||
    !Number.isFinite(effectiveReturn) ||
    effectiveReturn < 0 ||
    effectiveReturn > 1
  ) {
    effectiveReturn = DEFAULT_RETURN_RATE; // 0.08
    volatilitySource = 'SYSTEM_DEFAULT';
  }

  const rawVol = VOLATILITY_INTERCEPT + VOLATILITY_SLOPE * effectiveReturn;
  const sigmaAnnual = Math.min(VOLATILITY_MAX, Math.max(VOLATILITY_MIN, rawVol));
  const roundedSigma = Math.round(sigmaAnnual * 10000) / 10000;

  return {
    portfolioVolatility: roundedSigma,
    effectiveExpectedReturnRate: effectiveReturn,
    volatilitySource
  };
}

/**
 * Deterministically derive an integer simulation seed from financially relevant simulation inputs.
 * Uses canonical field formatting and SHA-256 hashing.
 * 
 * @param {Object} params - Normalized simulation parameters
 * @returns {number} Positive 31-bit integer seed for NumPy default_rng
 */
export function deriveMonteCarloSeed(params = {}) {
  const canonicalParts = [
    Number(params.startingCorpus || 0).toFixed(2),
    Number(params.monthlyContribution || 0).toFixed(2),
    Number(params.expectedReturnRate ?? DEFAULT_RETURN_RATE).toFixed(4),
    Number(params.expectedInflationRate ?? DEFAULT_INFLATION_RATE).toFixed(4),
    Number(params.portfolioVolatility ?? DEFAULT_PORTFOLIO_VOLATILITY).toFixed(4),
    Number(params.estimatedFireCorpus || 0).toFixed(2),
    params.userGoalCorpus && Number(params.userGoalCorpus) > 0 ? Number(params.userGoalCorpus).toFixed(2) : '0.00',
    String(params.monthsUntilRetirement ?? 0),
    String(params.contributionMode || 'NOMINAL_FLAT'),
    String(params.simulationCount || DEFAULT_SIMULATION_COUNT),
    params.currentAge !== null && params.currentAge !== undefined ? Number(params.currentAge).toFixed(2) : 'null',
    params.maxSearchAge !== null && params.maxSearchAge !== undefined ? Number(params.maxSearchAge).toFixed(2) : 'null'
  ];

  const canonicalString = canonicalParts.join('|');
  const hashHex = crypto.createHash('sha256').update(canonicalString).digest('hex');
  // First 8 hex characters (32 bits) converted to positive 31-bit integer
  const seed = (parseInt(hashHex.slice(0, 8), 16) % 2147483647) + 1;
  return seed;
}

/**
 * Construct normalized Monte Carlo request payload for Flask POST /simulate.
 * 
 * @param {Object} resolved - Resolved deterministic state from forecastResolver
 * @param {Object} [options={}] - Caller options
 * @param {Object} [extra={}] - Extra precomputed target values (estimatedFireCorpus, userGoalCorpus)
 * @returns {Object} JSON payload matching Flask simulation contract
 */
export function buildMonteCarloPayload(resolved = {}, options = {}, extra = {}) {
  const user = resolved.user || {};
  const rawExpectedReturn = user.expectedReturnRate;
  const {
    portfolioVolatility,
    effectiveExpectedReturnRate,
    volatilitySource
  } = derivePortfolioVolatility(rawExpectedReturn);

  const startingCorpus = Math.max(0, Number(resolved.fireInvestableCorpus) || 0);
  const monthlyContribution = Math.max(0, Number(resolved.monthlyContributionUsed) || 0);
  const expectedReturnRate = effectiveExpectedReturnRate;
  const expectedInflationRate = user.expectedInflationRate ?? DEFAULT_INFLATION_RATE;

  const estimatedFireCorpus = Math.max(0, Number(extra.estimatedFireCorpus ?? resolved.estimatedFireCorpus ?? 0));
  const userGoalCorpus = extra.userGoalCorpus !== undefined 
    ? (Number(extra.userGoalCorpus) > 0 ? Number(extra.userGoalCorpus) : null)
    : (Number(user.retirementCorpusGoal) > 0 ? Number(user.retirementCorpusGoal) : null);

  const monthsUntilRetirement = Number(resolved.monthsUntilRetirement ?? 0);
  const contributionMode = options.contributionMode || resolved.contributionMode || 'NOMINAL_FLAT';
  const simulationCount = Math.max(100, Math.min(100000, Number(options.simulationCount) || DEFAULT_SIMULATION_COUNT));

  const currentAge = resolved.currentAge !== null && resolved.currentAge !== undefined ? Number(resolved.currentAge) : null;
  const searchStartAge = options.searchStartAge !== undefined ? Number(options.searchStartAge) : currentAge;
  const maxSearchAge = options.maxSearchAge !== undefined 
    ? Number(options.maxSearchAge) 
    : (currentAge !== null ? Math.max(currentAge + 60, 90.0) : 90.0);

  const seed = options.seed !== undefined 
    ? Number(options.seed) 
    : deriveMonteCarloSeed({
        startingCorpus,
        monthlyContribution,
        expectedReturnRate,
        expectedInflationRate,
        portfolioVolatility,
        estimatedFireCorpus,
        userGoalCorpus,
        monthsUntilRetirement,
        contributionMode,
        simulationCount,
        currentAge,
        maxSearchAge
      });

  return {
    startingCorpus,
    monthlyContribution,
    expectedReturnRate,
    expectedInflationRate,
    portfolioVolatility,
    volatilitySource,
    estimatedFireCorpus,
    userGoalCorpus: userGoalCorpus || undefined,
    monthsUntilRetirement,
    contributionMode,
    simulationCount,
    seed,
    includeSimulation: options.includeSimulation ?? true,
    includeContributionSolver: options.includeContributionSolver ?? true,
    solverTargetProbability: options.solverTargetProbability ?? DEFAULT_SOLVER_TARGET_PROBABILITY,
    includeFundedAgeSolver: options.includeFundedAgeSolver ?? true,
    currentAge: currentAge ?? undefined,
    searchStartAge: searchStartAge ?? undefined,
    maxSearchAge: maxSearchAge ?? undefined,
    probabilityThresholds: options.probabilityThresholds || [0.50, 0.75]
  };
}

/**
 * Execute HTTP call to Python Flask microservice.
 * 
 * @param {Object} payload - Normalized simulation payload
 * @param {Object} [options={}] - Options (timeoutMs, clientUrl, fetchImpl)
 * @returns {Promise<Object>} Raw JSON response from Python service
 */
export async function callMonteCarloSimulation(payload, options = {}) {
  const url = options.clientUrl || `${ML_SERVICE_URL}/simulate`;
  const timeoutMs = options.timeoutMs || 5000;
  const fetchFn = options.fetchImpl || fetch;

  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const error = new Error(`Monte Carlo simulation HTTP network/timeout error: ${err.message || err}`);
    error.code = 'SIMULATION_SERVICE_UNAVAILABLE';
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error('Monte Carlo service returned invalid JSON');
    error.code = 'SIMULATION_SERVICE_UNAVAILABLE';
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data?.error?.message || `Monte Carlo service returned HTTP ${response.status}`);
    error.status = response.status;
    error.code = response.status === 400 ? 'SIMULATION_INPUT_REJECTED' : 'SIMULATION_SERVICE_ERROR';
    error.details = data?.error;
    throw error;
  }

  return data;
}

/**
 * Validate untrusted Python JSON response structure and numeric ranges.
 * 
 * @param {Object} data - Raw response object from Python
 * @returns {boolean} True if data adheres strictly to expected quantitative contract
 */
export function validateMonteCarloResponse(data) {
  if (!data || typeof data !== 'object') return false;

  // 1. Simulation section validation
  if (data.simulation) {
    const sim = data.simulation;
    const pFunded = sim.probabilityFundedAtTargetAge;
    if (typeof pFunded !== 'number' || !Number.isFinite(pFunded) || pFunded < 0 || pFunded > 1) {
      return false;
    }

    if (sim.corpusPercentiles && typeof sim.corpusPercentiles === 'object') {
      const { p10, p25, p50, p75, p90 } = sim.corpusPercentiles;
      const percentiles = [p10, p25, p50, p75, p90];
      for (const val of percentiles) {
        if (typeof val !== 'number' || !Number.isFinite(val)) return false;
      }
      // Monotonicity check
      if (!(p10 <= p25 && p25 <= p50 && p50 <= p75 && p75 <= p90)) {
        return false;
      }
    }
  }

  // 2. Contribution solver section validation
  if (data.contributionSolver) {
    const solver = data.contributionSolver;
    if (typeof solver.solved !== 'boolean') return false;
    if (solver.solved) {
      const rec = solver.recommendedMonthlyContribution;
      if (typeof rec !== 'number' || !Number.isFinite(rec) || rec < 0) return false;
      const ach = solver.achievedProbabilityFunded;
      if (typeof ach !== 'number' || !Number.isFinite(ach) || ach < 0 || ach > 1) return false;
    }
  }

  // 3. Funded age section validation
  if (data.fundedAge) {
    const fa = data.fundedAge;
    if (fa.fundedAge50 && typeof fa.fundedAge50 === 'object') {
      if (typeof fa.fundedAge50.reached !== 'boolean') return false;
      if (fa.fundedAge50.reached) {
        if (typeof fa.fundedAge50.ageYears !== 'number' || !Number.isFinite(fa.fundedAge50.ageYears)) return false;
        if (typeof fa.fundedAge50.monthsFromNow !== 'number' || !Number.isFinite(fa.fundedAge50.monthsFromNow)) return false;
      }
    }
  }

  return true;
}

/**
 * Evaluates product feasibility heuristic for contribution recommendations.
 *
 * Bands:
 *  - UNKNOWN: reliableMonthlyIncome is missing, non-finite, or <= 0
 *  - MANAGEABLE: recommendedContributionRatio <= 0.30 (<= 30%)
 *  - AGGRESSIVE: > 0.30 and <= 0.50 (30% - 50%)
 *  - VERY_AGGRESSIVE: > 0.50 and <= 0.80 (50% - 80%)
 *  - IMPRACTICAL: > 0.80 (> 80%)
 *
 * @param {number|null} recommendedMonthlyContribution
 * @param {number|null} additionalMonthlyContributionRequired
 * @param {number|null} reliableMonthlyIncome
 * @returns {Object} { status, recommendedContributionRatio, additionalContributionRatio, reliableMonthlyIncome }
 */
export function evaluateContributionFeasibility(
  recommendedMonthlyContribution,
  additionalMonthlyContributionRequired,
  reliableMonthlyIncome
) {
  if (
    reliableMonthlyIncome === null ||
    reliableMonthlyIncome === undefined ||
    typeof reliableMonthlyIncome !== 'number' ||
    !Number.isFinite(reliableMonthlyIncome) ||
    reliableMonthlyIncome <= 0
  ) {
    return {
      status: FEASIBILITY_STATUS.UNKNOWN,
      recommendedContributionRatio: null,
      additionalContributionRatio: null,
      reliableMonthlyIncome: null
    };
  }

  const rec = Number(recommendedMonthlyContribution);
  const add = Number(additionalMonthlyContributionRequired);

  if (!Number.isFinite(rec) || rec < 0) {
    return {
      status: FEASIBILITY_STATUS.UNKNOWN,
      recommendedContributionRatio: null,
      additionalContributionRatio: null,
      reliableMonthlyIncome
    };
  }

  const recRatio = rec / reliableMonthlyIncome;
  const addRatio = Number.isFinite(add) && add >= 0 ? add / reliableMonthlyIncome : 0;

  let status = FEASIBILITY_STATUS.MANAGEABLE;
  if (recRatio > FEASIBILITY_THRESHOLDS.VERY_AGGRESSIVE_MAX) {
    status = FEASIBILITY_STATUS.IMPRACTICAL;
  } else if (recRatio > FEASIBILITY_THRESHOLDS.AGGRESSIVE_MAX) {
    status = FEASIBILITY_STATUS.VERY_AGGRESSIVE;
  } else if (recRatio > FEASIBILITY_THRESHOLDS.MANAGEABLE_MAX) {
    status = FEASIBILITY_STATUS.AGGRESSIVE;
  } else {
    status = FEASIBILITY_STATUS.MANAGEABLE;
  }

  return {
    status,
    recommendedContributionRatio: Math.round(recRatio * 10000) / 10000,
    additionalContributionRatio: Math.round(addRatio * 10000) / 10000,
    reliableMonthlyIncome
  };
}

/**
 * Evaluates comparative retirement-age alternative scenarios (+2y, +5y, +10y).
 *
 * CRN Policy:
 *  - Reuses the BASE forecast's Monte Carlo seed (basePayload.seed) for all alternative horizons
 *    to preserve Common Random Numbers across comparative scenarios.
 *
 * Minimal Payload:
 *  - includeSimulation = true
 *  - includeContributionSolver = true
 *  - includeFundedAgeSolver = false
 *
 * Resilience:
 *  - Uses Promise.allSettled so single alternative failures do not fail other alternatives
 *    or the parent snapshot.
 *
 * @param {Object} resolved - Resolved inputs from forecastResolver
 * @param {Object} options - Options
 * @param {Object} basePayload - Normal base Monte Carlo request payload
 * @param {Object} baseSnapshot - Deterministic snapshot
 * @param {number|null} reliableMonthlyIncome - Authoritative reliable monthly income
 * @returns {Promise<Array<Object>|null>} Array of alternative scenarios or null
 */
export async function calculateRetirementAlternatives(
  resolved,
  options,
  basePayload,
  baseSnapshot,
  reliableMonthlyIncome
) {
  const currentAge = Number(resolved.currentAge ?? resolved.user?.age);
  const baseRetAge = Number(resolved.retirementAge ?? resolved.user?.retirementAge ?? 60);

  if (!Number.isFinite(currentAge) || !Number.isFinite(baseRetAge) || currentAge >= baseRetAge) {
    return null;
  }

  const offsets = options.alternativeAgeOffsets || DEFAULT_ALTERNATIVE_AGE_OFFSETS;
  const maxAltAge = Math.min(MAX_RETIREMENT_ALTERNATIVE_AGE, options.maxSearchAge || 90);

  // Generate unique valid target ages within supported limits
  const targetAges = [];
  const seenAges = new Set([baseRetAge]);

  for (const offset of offsets) {
    const candidateAge = baseRetAge + offset;
    if (candidateAge <= maxAltAge && !seenAges.has(candidateAge)) {
      seenAges.add(candidateAge);
      targetAges.push({
        targetAge: candidateAge,
        yearsExtended: offset,
        monthsUntilRetirement: Math.round((candidateAge - currentAge) * 12)
      });
    }
  }

  if (targetAges.length === 0) {
    return null;
  }

  // Build minimal payload for each alternative using Common Random Numbers (basePayload.seed)
  const alternativePromises = targetAges.map(async (alt) => {
    const altPayload = {
      startingCorpus: basePayload.startingCorpus,
      monthlyContribution: basePayload.monthlyContribution,
      expectedReturnRate: basePayload.expectedReturnRate,
      expectedInflationRate: basePayload.expectedInflationRate,
      portfolioVolatility: basePayload.portfolioVolatility,
      volatilitySource: basePayload.volatilitySource,
      estimatedFireCorpus: basePayload.estimatedFireCorpus,
      userGoalCorpus: null,
      monthsUntilRetirement: alt.monthsUntilRetirement,
      contributionMode: basePayload.contributionMode,
      simulationCount: basePayload.simulationCount,
      seed: basePayload.seed, // CRITICAL: Reuse BASE forecast seed for CRN cross-horizon comparison
      includeSimulation: true,
      includeContributionSolver: true,
      includeFundedAgeSolver: false, // Minimal simulation: omit funded age
      solverTargetProbability: basePayload.solverTargetProbability || DEFAULT_SOLVER_TARGET_PROBABILITY
    };

    const rawData = await callMonteCarloSimulation(altPayload, options);
    const isValid = validateMonteCarloResponse(rawData);
    if (!isValid) {
      throw new Error(`Invalid simulation response for alternative age ${alt.targetAge}`);
    }

    const sim = rawData.simulation || {};
    const solver = rawData.contributionSolver || {};

    const recContribution = solver.recommendedMonthlyContribution ?? null;
    const addContribution = solver.additionalMonthlyContributionRequired ?? 0;
    const feasibility = evaluateContributionFeasibility(
      recContribution,
      addContribution,
      reliableMonthlyIncome
    );

    return {
      targetAge: alt.targetAge,
      yearsExtended: alt.yearsExtended,
      monthsUntilRetirement: alt.monthsUntilRetirement,
      probabilityFundedAtTargetAge: sim.probabilityFundedAtTargetAge ?? null,
      recommendedMonthlyContribution: recContribution,
      additionalMonthlyContributionRequired: addContribution,
      achievedProbabilityFunded: solver.achievedProbabilityFunded ?? null,
      targetProbability: solver.targetProbability ?? (basePayload.solverTargetProbability || DEFAULT_SOLVER_TARGET_PROBABILITY),
      solved: solver.solved ?? false,
      feasibility
    };
  });

  const results = await Promise.allSettled(alternativePromises);
  const successfulAlternatives = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === 'fulfilled' && res.value) {
      successfulAlternatives.push(res.value);
    } else {
      logger.warn(`[PredictabilityService] Alternative scenario +${targetAges[i].yearsExtended}y (age ${targetAges[i].targetAge}) failed:`, res.reason?.message || res.reason);
    }
  }

  if (successfulAlternatives.length === 0) {
    return null;
  }

  // Sort by targetAge ascending
  return successfulAlternatives.sort((a, b) => a.targetAge - b.targetAge);
}

/**
 * Transform validated Python simulation response into public additive probabilistic section.
 * 
 * @param {Object} data - Validated response from Python service
 * @param {Object} payload - Sent request payload (contains assumptions and targets)
 * @param {string} dataQuality - PW-1 data quality level ('HIGH' | 'MEDIUM' | 'LOW')
 * @param {Object|null} feasibility - Evaluated contribution recommendation feasibility
 * @param {Array<Object>|null} retirementAlternatives - Comparative retirement age alternatives
 * @returns {Object} Clean public probabilistic response contract
 */
export function mapMonteCarloResponse(data, payload, dataQuality = 'MEDIUM', feasibility = null, retirementAlternatives = null) {
  const sim = data.simulation || {};
  const solver = data.contributionSolver || null;
  const fundedAge = data.fundedAge || null;

  return {
    available: true,
    engineVersion: data.meta?.engineVersion || MONTE_CARLO_ENGINE_VERSION,
    simulationCount: data.meta?.simulationCount || payload.simulationCount,
    dataQuality,
    warnings: ['PORTFOLIO_RISK_ESTIMATED'],
    assumptions: {
      expectedReturnRate: payload.expectedReturnRate,
      expectedInflationRate: payload.expectedInflationRate,
      portfolioVolatility: payload.portfolioVolatility,
      volatilitySource: payload.volatilitySource || 'RETURN_DERIVED',
      contributionMode: payload.contributionMode,
      seed: payload.seed
    },
    estimatedFire: {
      targetAmountReal: payload.estimatedFireCorpus,
      probabilityFundedAtTargetAge: sim.probabilityFundedAtTargetAge ?? null,
      probabilityReachedFireByTargetAge: sim.probabilityReachedFireByTargetAge ?? null,
      corpusPercentiles: sim.corpusPercentiles ?? null,
      fundedAge50: fundedAge?.fundedAge50 ?? null,
      fundedAge75: fundedAge?.fundedAge75 ?? null,
      firstCrossing: sim.firstCrossing ?? null
    },
    userGoal: payload.userGoalCorpus && payload.userGoalCorpus > 0 ? {
      targetAmountReal: payload.userGoalCorpus,
      probabilityFundedAtTargetAge: sim.userGoal?.probabilityFundedAtTargetAge ?? null,
      probabilityReachedByTargetAge: sim.userGoal?.probabilityReachedByTargetAge ?? null,
      fundedAge50: fundedAge?.userGoalFundedAge50 ?? null,
      fundedAge75: fundedAge?.userGoalFundedAge75 ?? null
    } : null,
    contributionRecommendation: solver ? {
      solved: solver.solved,
      targetProbability: solver.targetProbability,
      currentMonthlyContribution: solver.currentMonthlyContribution,
      currentProbabilityFunded: solver.currentProbabilityFunded,
      recommendedMonthlyContribution: solver.recommendedMonthlyContribution,
      additionalMonthlyContributionRequired: solver.additionalMonthlyContributionRequired,
      achievedProbabilityFunded: solver.achievedProbabilityFunded,
      recommendationIncrement: solver.recommendationIncrement,
      feasibility: feasibility ?? null
    } : null,
    retirementAlternatives: retirementAlternatives || null
  };
}

/**
 * High-level orchestrator to execute Monte Carlo and attach result onto predictability snapshot.
 * 
 * @param {Object} snapshot - Deterministic snapshot returned by buildPredictabilitySnapshot
 * @param {Object} resolved - Resolved inputs from forecastResolver
 * @param {Object} [options={}] - Options & configuration
 * @returns {Promise<Object>} Mutated snapshot with additive probabilistic section and explanationFacts
 */
export async function attachMonteCarloSimulation(snapshot, resolved, options = {}) {
  // 1. Forecast availability gate
  if (!snapshot.forecastStatus?.available) {
    snapshot.probabilistic = {
      available: false,
      reason: 'FORECAST_INPUTS_UNAVAILABLE',
      missingInputs: snapshot.forecastStatus?.missingInputs || [],
      dataQuality: snapshot.forecastStatus?.dataQuality || 'INSUFFICIENT'
    };
    snapshot.explanationFacts.push({
      code: 'MONTE_CARLO_UNAVAILABLE',
      value: 'FORECAST_INPUTS_UNAVAILABLE'
    });
    return snapshot;
  }

  // 2. Explicit simulation bypass option (e.g. for pure deterministic unit runs)
  if (options.skipSimulation === true) {
    snapshot.probabilistic = {
      available: false,
      reason: 'SIMULATION_SKIPPED'
    };
    return snapshot;
  }

  // 3. Build normalized payload
  const payload = buildMonteCarloPayload(resolved, options, {
    estimatedFireCorpus: snapshot.retirement?.estimatedFireCorpus,
    userGoalCorpus: snapshot.retirement?.userGoalCorpus
  });

  // 4. Call Python service
  try {
    const rawData = await callMonteCarloSimulation(payload, options);

    // 5. Validate Python response shape and ranges
    const isValid = validateMonteCarloResponse(rawData);
    if (!isValid) {
      logger.warn('[PredictabilityService] Python Monte Carlo returned malformed response shape or range violation');
      snapshot.probabilistic = {
        available: false,
        reason: 'SIMULATION_RESPONSE_INVALID'
      };
      snapshot.explanationFacts.push({
        code: 'MONTE_CARLO_UNAVAILABLE',
        value: 'SIMULATION_RESPONSE_INVALID'
      });
      return snapshot;
    }

    // 6. Evaluate reliable monthly income & contribution feasibility
    const reliableMonthlyIncome = (
      typeof snapshot.income?.reliableMonthlyIncome === 'number' && snapshot.income.reliableMonthlyIncome > 0
    ) ? snapshot.income.reliableMonthlyIncome : (
      typeof snapshot.income?.meanMonthlyIncome === 'number' && snapshot.income.meanMonthlyIncome > 0
    ) ? snapshot.income.meanMonthlyIncome : (
      typeof resolved.user?.monthlyIncome === 'number' && resolved.user.monthlyIncome > 0
    ) ? resolved.user.monthlyIncome : null;

    const solver = rawData.contributionSolver;
    let baseFeasibility = null;
    if (solver && solver.solved) {
      baseFeasibility = evaluateContributionFeasibility(
        solver.recommendedMonthlyContribution,
        solver.additionalMonthlyContributionRequired,
        reliableMonthlyIncome
      );
    }

    // 7. Evaluate retirement alternatives if appropriate
    let retirementAlternatives = null;
    const shouldCalculateAlternatives = (
      options.skipAlternatives !== true &&
      solver &&
      solver.solved === true &&
      solver.additionalMonthlyContributionRequired > 0 &&
      baseFeasibility &&
      (
        baseFeasibility.status === FEASIBILITY_STATUS.AGGRESSIVE ||
        baseFeasibility.status === FEASIBILITY_STATUS.VERY_AGGRESSIVE ||
        baseFeasibility.status === FEASIBILITY_STATUS.IMPRACTICAL ||
        options.forceAlternatives === true
      )
    );

    if (shouldCalculateAlternatives) {
      try {
        retirementAlternatives = await calculateRetirementAlternatives(
          resolved,
          options,
          payload,
          snapshot,
          reliableMonthlyIncome
        );
      } catch (altErr) {
        logger.warn('[PredictabilityService] Error calculating retirement alternatives, omitting alternatives:', altErr.message || altErr);
        retirementAlternatives = null;
      }
    }

    // 8. Map to clean public contract
    snapshot.probabilistic = mapMonteCarloResponse(
      rawData,
      payload,
      snapshot.forecastStatus?.dataQuality,
      baseFeasibility,
      retirementAlternatives
    );

    // 9. Add machine-readable explanation facts
    snapshot.explanationFacts.push({
      code: 'MONTE_CARLO_AVAILABLE',
      value: true
    });
    if (typeof snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge === 'number') {
      snapshot.explanationFacts.push({
        code: 'MONTE_CARLO_PROBABILITY_FUNDED',
        metric: 'probabilityFundedAtTargetAge',
        value: snapshot.probabilistic.estimatedFire.probabilityFundedAtTargetAge
      });
    }
    snapshot.explanationFacts.push({
      code: 'MONTE_CARLO_VOLATILITY_ASSUMPTION',
      metric: 'portfolioVolatility',
      value: payload.portfolioVolatility
    });
    snapshot.explanationFacts.push({
      code: 'PORTFOLIO_RISK_ESTIMATED',
      value: true
    });
    if (snapshot.forecastStatus?.dataQuality === 'LOW') {
      snapshot.explanationFacts.push({
        code: 'MONTE_CARLO_DATA_QUALITY_LOW',
        value: 'LOW'
      });
    }

    return snapshot;
  } catch (err) {
    // 10. Graceful error handling (distinguish 400 client rejection vs network/500 failure)
    const reason = err.code || 'SIMULATION_SERVICE_UNAVAILABLE';
    if (err.code === 'SIMULATION_INPUT_REJECTED') {
      logger.error('[PredictabilityService] Monte Carlo input rejected by Python microservice (HTTP 400):', err.message || err);
    } else {
      logger.warn('[PredictabilityService] Monte Carlo simulation unavailable, falling back to deterministic baseline:', err.message || err);
    }

    snapshot.probabilistic = {
      available: false,
      reason,
      details: err.status === 400 ? (err.message || 'Input rejected') : undefined
    };
    snapshot.explanationFacts.push({
      code: 'MONTE_CARLO_UNAVAILABLE',
      value: reason
    });

    return snapshot;
  }
}
