/**
 * server/config/financialRules.js
 * 
 * Centralised engine defaults and constants for FINAURA financial mathematics.
 * These act as the single source of truth for both Mongoose model defaults
 * and financial math projections.
 */

export const DEFAULT_RETURN_RATE = 0.08;
export const DEFAULT_INFLATION_RATE = 0.06;
export const DEFAULT_WITHDRAWAL_RATE = 0.04;
export const DEFAULT_LIFESTYLE_RATIO = 0.80;
export const DEFAULT_EMERGENCY_MONTHS = 6;

// Constraints
export const MAX_PROJECTION_MONTHS = 1200; // 100 years
export const EPSILON = 1e-9;

// Contribution Modeling Modes
export const CONTRIBUTION_MODE = Object.freeze({
  REAL_CONSTANT: 'REAL_CONSTANT',
  NOMINAL_FLAT: 'NOMINAL_FLAT',
  STEP_UP: 'STEP_UP'
});
export const MAX_ANNUAL_CONTRIBUTION_GROWTH_RATE = 0.50; // Max 50% annual contribution escalation

// Scenario Engine V1 Assumption Profiles
export const DEFAULT_SCENARIOS = Object.freeze({
  CONSERVATIVE: Object.freeze({
    id: 'conservative',
    label: 'Conservative',
    nominalReturnOffset: -0.02, // -2.0% nominal return
    inflationOffset: 0.01,      // +1.0% inflation
    withdrawalRateOffset: 0.00  // SWR remains a stable retirement-planning policy assumption
  }),
  BASE: Object.freeze({
    id: 'base',
    label: 'Base',
    nominalReturnOffset: 0.00,
    inflationOffset: 0.00,
    withdrawalRateOffset: 0.00
  }),
  OPTIMISTIC: Object.freeze({
    id: 'optimistic',
    label: 'Optimistic',
    nominalReturnOffset: 0.02,  // +2.0% nominal return
    inflationOffset: -0.01,     // -1.0% inflation
    withdrawalRateOffset: 0.00  // SWR remains a stable retirement-planning policy assumption
  })
});

// Monte Carlo Simulation Engine Defaults (V1)
export const DEFAULT_SIMULATION_COUNT = 10000;    // 10,000 Monte Carlo paths for V1 production
export const DEFAULT_SOLVER_TARGET_PROBABILITY = 0.75; // 75% target funding probability
export const MONTE_CARLO_ENGINE_VERSION = 'mc-v1';

// Frozen V1 Volatility Model Constants: sigma = clamp(-0.04 + 2.0 * returnRate, 0.06, 0.22)
export const VOLATILITY_INTERCEPT = -0.04;
export const VOLATILITY_SLOPE = 2.0;
export const VOLATILITY_MIN = 0.06;
export const VOLATILITY_MAX = 0.22;
export const DEFAULT_PORTFOLIO_VOLATILITY = 0.12; // Corresponding to DEFAULT_RETURN_RATE = 0.08: clamp(-0.04 + 2 * 0.08, 0.06, 0.22) = 0.12

// Contribution Recommendation Feasibility Bands (Product Heuristics)
export const FEASIBILITY_STATUS = Object.freeze({
  MANAGEABLE: 'MANAGEABLE',
  AGGRESSIVE: 'AGGRESSIVE',
  VERY_AGGRESSIVE: 'VERY_AGGRESSIVE',
  IMPRACTICAL: 'IMPRACTICAL',
  UNKNOWN: 'UNKNOWN'
});

export const FEASIBILITY_THRESHOLDS = Object.freeze({
  MANAGEABLE_MAX: 0.30,      // <= 30% of reliable monthly income
  AGGRESSIVE_MAX: 0.50,      // > 30% and <= 50%
  VERY_AGGRESSIVE_MAX: 0.80  // > 50% and <= 80%; > 80% is IMPRACTICAL
});

// Retirement-Age Alternative Scenarios Configuration
export const DEFAULT_ALTERNATIVE_AGE_OFFSETS = Object.freeze([2, 5, 10]); // +2y, +5y, +10y
export const MAX_RETIREMENT_ALTERNATIVE_AGE = 90; // Technical ceiling for alternative scenario evaluation
