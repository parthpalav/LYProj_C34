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
  NOMINAL_FLAT: 'NOMINAL_FLAT'
});

