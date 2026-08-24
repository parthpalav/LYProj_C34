/**
 * server/utils/financialMath.js
 * 
 * Pure deterministic financial mathematics library for FINAURA.
 * No database access, no HTTP calls, no external side-effects.
 * All interest and return rates are decimal fractions (e.g., 0.08 = 8%).
 * 
 * Conventions:
 *  - Investment growth: Effective Annual Rate (EAR) compounded monthly:
 *      r_monthly = (1 + r_annual)^(1/12) - 1
 *  - Debt amortization: Nominal Annual Percentage Rate (APR) divided monthly:
 *      r_monthly = APR / 12
 *  - Contribution timing: End-of-Month (Ordinary Annuity) is canonical V1 default.
 *  - Contribution modes:
 *      * REAL_CONSTANT: Monthly savings keep constant purchasing power (escalating nominally with inflation).
 *      * NOMINAL_FLAT: Fixed rupee SIP every month (deflated by inflation over time in real terms).
 */

import { MAX_PROJECTION_MONTHS, EPSILON, CONTRIBUTION_MODE } from '../config/financialRules.js';

export { CONTRIBUTION_MODE };

/**
 * Validates that a value is a finite positive or zero number.
 */
function validateNonNegativeFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number, got ${value}`);
  }
}

/**
 * Validates that a value is a finite number.
 */
function validateFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, got ${value}`);
  }
}

/**
 * Calculates real return using the exact Fisher equation:
 * realReturn = (1 + nominal) / (1 + inflation) - 1
 * 
 * @param {number} nominalReturn - Nominal rate (decimal fraction)
 * @param {number} inflationRate - Inflation rate (decimal fraction)
 * @returns {number} Real return rate
 */
export function realReturn(nominalReturn, inflationRate) {
  validateFinite(nominalReturn, 'nominalReturn');
  validateFinite(inflationRate, 'inflationRate');
  if (inflationRate <= -1) {
    throw new RangeError('inflationRate must be greater than -1.0 (-100%)');
  }
  return (1 + nominalReturn) / (1 + inflationRate) - 1;
}

/**
 * Converts an effective annual rate (EAR) to an effective monthly rate (EMR):
 * monthlyRate = (1 + annualRate)^(1/12) - 1
 * 
 * @param {number} annualRate - Effective annual rate
 * @returns {number} Effective monthly rate
 */
export function monthlyRateFromAnnual(annualRate) {
  validateFinite(annualRate, 'annualRate');
  if (annualRate <= -1) {
    throw new RangeError('annualRate must be greater than -1.0 (-100%)');
  }
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Calculates Future Value of a lump sum principal:
 * FV = PV * (1 + r_m)^n
 * 
 * @param {number} principal - Present value principal (P)
 * @param {number} annualRate - Effective annual interest rate
 * @param {number} months - Number of compounding periods in months (n)
 * @returns {number} Future value
 */
export function futureValueLumpSum(principal, annualRate, months) {
  validateNonNegativeFinite(principal, 'principal');
  validateFinite(annualRate, 'annualRate');
  if (annualRate <= -1) {
    throw new RangeError('annualRate must be greater than -1.0 (-100%)');
  }
  if (!Number.isInteger(months) || months < 0) {
    throw new TypeError(`months must be a non-negative integer, got ${months}`);
  }

  if (months === 0 || principal === 0) return principal;

  const monthlyRate = monthlyRateFromAnnual(annualRate);
  return principal * Math.pow(1 + monthlyRate, months);
}

/**
 * Calculates Future Value of REAL_CONSTANT recurring monthly contributions.
 * Real constant contributions maintain constant purchasing power (in today's rupees),
 * meaning the actual nominal contribution escalates over time with inflation.
 * 
 * Timing: Canonical V1 assumes contributions at the END of each month (Ordinary Annuity).
 * Optional: supports beginning of month (Annuity Due) via isBeginningOfMonth option.
 * 
 * Ordinary: FV_real = PMT_real * [((1 + r_real)^n - 1) / r_real]
 * Due:      FV_real = Ordinary * (1 + r_real)
 * 
 * @param {Object} params
 * @param {number} params.monthlyContribution - Monthly contribution in today's real purchasing power
 * @param {number} params.realAnnualReturn - Real annual expected return
 * @param {number} params.months - Projection horizon in months
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {number} Future value of contributions in today's purchasing power (real terms)
 */
export function futureValueRealConstantContributions({
  monthlyContribution,
  realAnnualReturn,
  months,
  isBeginningOfMonth = false
}) {
  validateNonNegativeFinite(monthlyContribution, 'monthlyContribution');
  validateFinite(realAnnualReturn, 'realAnnualReturn');
  if (realAnnualReturn <= -1) {
    throw new RangeError('realAnnualReturn must be greater than -1.0 (-100%)');
  }
  if (!Number.isInteger(months) || months < 0) {
    throw new TypeError(`months must be a non-negative integer, got ${months}`);
  }

  if (months === 0 || monthlyContribution === 0) return 0;

  const monthlyRate = monthlyRateFromAnnual(realAnnualReturn);

  let fvOrdinary;
  if (Math.abs(monthlyRate) < EPSILON) {
    fvOrdinary = monthlyContribution * months;
  } else {
    fvOrdinary = monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  }

  if (isBeginningOfMonth) {
    return fvOrdinary * (1 + monthlyRate);
  }
  return fvOrdinary;
}

/**
 * Backwards-compatible alias for futureValueRealConstantContributions.
 * Defaults to REAL_CONSTANT contributions at the specified annualRate.
 */
export function futureValueContributions(monthlyContribution, annualRate, months, isBeginningOfMonth = false) {
  return futureValueRealConstantContributions({
    monthlyContribution,
    realAnnualReturn: annualRate,
    months,
    isBeginningOfMonth
  });
}

/**
 * Calculates Future Value of NOMINAL_FLAT recurring monthly contributions in REAL terms.
 * The user contributes the exact same fixed rupee amount (e.g. ₹20,000) every month.
 * Because contributions do not scale with inflation, their real purchasing power shrinks.
 * 
 * Method:
 *  1. Calculate future nominal value using nominal return:
 *     FV_nominal = PMT_nominal * [((1 + r_nom)^n - 1) / r_nom]
 *  2. Deflate nominal future value back to today's purchasing power using inflation:
 *     FV_real = FV_nominal / (1 + inflationRate)^(n/12)
 * 
 * @param {Object} params
 * @param {number} params.monthlyContribution - Flat nominal monthly savings amount (PMT)
 * @param {number} params.nominalAnnualReturn - Nominal annual expected return
 * @param {number} params.inflationRate - Annual inflation rate
 * @param {number} params.months - Projection horizon in months
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {number} Real future value of flat nominal contributions
 */
export function futureValueNominalFlatContributions({
  monthlyContribution,
  nominalAnnualReturn,
  inflationRate,
  months,
  isBeginningOfMonth = false
}) {
  validateNonNegativeFinite(monthlyContribution, 'monthlyContribution');
  validateFinite(nominalAnnualReturn, 'nominalAnnualReturn');
  validateFinite(inflationRate, 'inflationRate');
  if (nominalAnnualReturn <= -1) {
    throw new RangeError('nominalAnnualReturn must be greater than -1.0 (-100%)');
  }
  if (inflationRate <= -1) {
    throw new RangeError('inflationRate must be greater than -1.0 (-100%)');
  }
  if (!Number.isInteger(months) || months < 0) {
    throw new TypeError(`months must be a non-negative integer, got ${months}`);
  }

  if (months === 0 || monthlyContribution === 0) return 0;

  // 1. Calculate future nominal value of contributions
  const fvNominal = futureValueRealConstantContributions({
    monthlyContribution,
    realAnnualReturn: nominalAnnualReturn,
    months,
    isBeginningOfMonth
  });

  // 2. Deflate nominal future value back to today's purchasing power
  return fvNominal / Math.pow(1 + inflationRate, months / 12);
}

/**
 * Combines lump sum growth and recurring REAL_CONSTANT monthly contributions FV.
 * 
 * @param {Object} params
 * @param {number} params.currentPrincipal - Starting principal (in today's rupees)
 * @param {number} params.monthlyContribution - Monthly savings in today's purchasing power
 * @param {number} params.realAnnualReturn - Real annual return rate
 * @param {number} params.months - Months horizon
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {Object} { futureValueOfPrincipal, futureValueOfContributions, totalFutureValue }
 */
export function futureValueRealConstant({
  currentPrincipal,
  monthlyContribution,
  realAnnualReturn,
  months,
  isBeginningOfMonth = false
}) {
  const fvPrincipal = futureValueLumpSum(currentPrincipal, realAnnualReturn, months);
  const fvContributions = futureValueRealConstantContributions({
    monthlyContribution,
    realAnnualReturn,
    months,
    isBeginningOfMonth
  });

  return {
    futureValueOfPrincipal: fvPrincipal,
    futureValueOfContributions: fvContributions,
    totalFutureValue: fvPrincipal + fvContributions
  };
}

/**
 * Combines lump sum growth and recurring NOMINAL_FLAT monthly contributions FV.
 * Provides both real (deflated) and nominal projection breakdowns.
 * 
 * @param {Object} params
 * @param {number} params.currentPrincipal - Starting principal (in today's rupees)
 * @param {number} params.monthlyContribution - Fixed nominal monthly savings (PMT)
 * @param {number} params.nominalAnnualReturn - Nominal annual return rate
 * @param {number} params.inflationRate - Annual inflation rate
 * @param {number} params.months - Months horizon
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {Object} Real and nominal breakdown of principal and contributions
 */
export function futureValueNominalFlat({
  currentPrincipal,
  monthlyContribution,
  nominalAnnualReturn,
  inflationRate,
  months,
  isBeginningOfMonth = false
}) {
  const rReal = realReturn(nominalAnnualReturn, inflationRate);
  const fvPrincipalReal = futureValueLumpSum(currentPrincipal, rReal, months);
  const fvContributionsReal = futureValueNominalFlatContributions({
    monthlyContribution,
    nominalAnnualReturn,
    inflationRate,
    months,
    isBeginningOfMonth
  });

  const fvPrincipalNominal = futureValueLumpSum(currentPrincipal, nominalAnnualReturn, months);
  const fvContributionsNominal = futureValueRealConstantContributions({
    monthlyContribution,
    realAnnualReturn: nominalAnnualReturn,
    months,
    isBeginningOfMonth
  });

  return {
    futureValueOfPrincipalReal: fvPrincipalReal,
    futureValueOfContributionsReal: fvContributionsReal,
    totalFutureValueReal: fvPrincipalReal + fvContributionsReal,
    futureValueOfPrincipalNominal: fvPrincipalNominal,
    futureValueOfContributionsNominal: fvContributionsNominal,
    totalFutureValueNominal: fvPrincipalNominal + fvContributionsNominal
  };
}

/**
 * Backwards-compatible alias for futureValue.
 * Defaults to REAL_CONSTANT mode.
 */
export function futureValue({ currentPrincipal, monthlyContribution, annualRate, months, isBeginningOfMonth = false }) {
  return futureValueRealConstant({
    currentPrincipal,
    monthlyContribution,
    realAnnualReturn: annualRate,
    months,
    isBeginningOfMonth
  });
}

/**
 * Solves for the required REAL_CONSTANT monthly contribution (PMT)
 * to reach targetFutureValueReal in today's purchasing power.
 * 
 * Meaning: "Contribute this amount in today's purchasing power, increasing
 * nominal rupee contributions over time with inflation."
 * 
 * @param {Object} params
 * @param {number} params.currentPrincipal - Starting principal (in today's rupees)
 * @param {number} params.targetFutureValueReal - Target retirement corpus (in today's rupees)
 * @param {number} params.realAnnualReturn - Real annual return rate
 * @param {number} params.months - Months remaining (n)
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {number} Required monthly contribution in today's real rupees
 */
export function requiredRealConstantContribution({
  currentPrincipal,
  targetFutureValueReal,
  realAnnualReturn,
  months,
  isBeginningOfMonth = false
}) {
  validateNonNegativeFinite(currentPrincipal, 'currentPrincipal');
  validateNonNegativeFinite(targetFutureValueReal, 'targetFutureValueReal');
  validateFinite(realAnnualReturn, 'realAnnualReturn');
  if (realAnnualReturn <= -1) {
    throw new RangeError('realAnnualReturn must be greater than -1.0 (-100%)');
  }
  if (!Number.isInteger(months) || months < 0) {
    throw new TypeError(`months must be a non-negative integer, got ${months}`);
  }

  const monthlyRate = monthlyRateFromAnnual(realAnnualReturn);
  const fvPrincipal = futureValueLumpSum(currentPrincipal, realAnnualReturn, months);
  const remainingTarget = targetFutureValueReal - fvPrincipal;

  if (remainingTarget <= 0) return 0;

  if (months === 0) {
    throw new RangeError('Target corpus is unreachable with zero months remaining');
  }

  let pmtOrdinary;
  if (Math.abs(monthlyRate) < EPSILON) {
    pmtOrdinary = remainingTarget / months;
  } else {
    pmtOrdinary = (remainingTarget * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
  }

  if (isBeginningOfMonth) {
    return pmtOrdinary / (1 + monthlyRate);
  }
  return pmtOrdinary;
}

/**
 * Backwards-compatible alias for requiredRealConstantContribution.
 */
export function requiredMonthlyContribution({ currentPrincipal, targetFutureValue, annualRate, months, isBeginningOfMonth = false }) {
  return requiredRealConstantContribution({
    currentPrincipal,
    targetFutureValueReal: targetFutureValue,
    realAnnualReturn: annualRate,
    months,
    isBeginningOfMonth
  });
}

/**
 * Solves for the required NOMINAL_FLAT monthly contribution (PMT)
 * to reach targetFutureValueReal in today's purchasing power.
 * 
 * Meaning: "Contribute this exact fixed rupee amount every month without
 * increasing contributions for inflation."
 * 
 * Method (Option A - Entire projection in nominal terms):
 *  1. Inflate target to future nominal rupees:
 *     targetNominal = targetFutureValueReal * (1 + inflationRate)^(months / 12)
 *  2. Grow current principal using nominal return:
 *     principalNominal = futureValueLumpSum(currentPrincipal, nominalAnnualReturn, months)
 *  3. Solve for required fixed nominal PMT using nominal return.
 * 
 * @param {Object} params
 * @param {number} params.currentPrincipal - Starting principal (in today's rupees)
 * @param {number} params.targetFutureValueReal - Target retirement corpus (in today's rupees)
 * @param {number} params.nominalAnnualReturn - Nominal annual expected return
 * @param {number} params.inflationRate - Annual inflation rate
 * @param {number} params.months - Months remaining (n)
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {number} Required fixed nominal monthly contribution (PMT)
 */
export function requiredNominalFlatContribution({
  currentPrincipal,
  targetFutureValueReal,
  nominalAnnualReturn,
  inflationRate,
  months,
  isBeginningOfMonth = false
}) {
  validateNonNegativeFinite(currentPrincipal, 'currentPrincipal');
  validateNonNegativeFinite(targetFutureValueReal, 'targetFutureValueReal');
  validateFinite(nominalAnnualReturn, 'nominalAnnualReturn');
  validateFinite(inflationRate, 'inflationRate');
  if (nominalAnnualReturn <= -1) {
    throw new RangeError('nominalAnnualReturn must be greater than -1.0 (-100%)');
  }
  if (inflationRate <= -1) {
    throw new RangeError('inflationRate must be greater than -1.0 (-100%)');
  }
  if (!Number.isInteger(months) || months < 0) {
    throw new TypeError(`months must be a non-negative integer, got ${months}`);
  }

  // 1. Inflate real target to future nominal terms at the horizon
  const targetNominal = targetFutureValueReal * Math.pow(1 + inflationRate, months / 12);

  // 2. Solve in nominal space
  return requiredRealConstantContribution({
    currentPrincipal,
    targetFutureValueReal: targetNominal,
    realAnnualReturn: nominalAnnualReturn,
    months,
    isBeginningOfMonth
  });
}

/**
 * Deterministic helper to calculate the retirement corpus required based on current lifestyle spending:
 * retirementAnnualSpending = currentAnnualLifestyleSpending * lifestyleAdjustmentRatio
 * fireCorpus = retirementAnnualSpending / safeWithdrawalRate
 * 
 * Note: Calculated in today's purchasing power (nominal/inflation consistent)
 * 
 * @param {Object} params
 * @param {number} [params.currentAnnualLifestyleSpending] - Total annual lifestyle spending (Needs + Wants)
 * @param {number} [params.currentAnnualEssentialSpending] - Fallback alias for backwards compatibility
 * @param {number} params.lifestyleAdjustmentRatio - Lifestyle multiplier (e.g. 0.8)
 * @param {number} params.safeWithdrawalRate - Safe withdrawal rate (SWR, e.g. 0.04)
 * @returns {Object} { retirementAnnualSpending, fireCorpus }
 */
export function calculateFireCorpus({
  currentAnnualLifestyleSpending,
  currentAnnualEssentialSpending,
  lifestyleAdjustmentRatio,
  safeWithdrawalRate
}) {
  const spending = currentAnnualLifestyleSpending !== undefined
    ? currentAnnualLifestyleSpending
    : currentAnnualEssentialSpending;

  validateNonNegativeFinite(spending, 'currentAnnualLifestyleSpending');
  validateNonNegativeFinite(lifestyleAdjustmentRatio, 'lifestyleAdjustmentRatio');
  validateFinite(safeWithdrawalRate, 'safeWithdrawalRate');

  if (safeWithdrawalRate <= 0) {
    throw new RangeError('safeWithdrawalRate must be greater than 0');
  }

  const retirementAnnualSpending = spending * lifestyleAdjustmentRatio;
  const fireCorpus = retirementAnnualSpending / safeWithdrawalRate;

  return {
    retirementAnnualSpending,
    fireCorpus
  };
}

/**
 * Exposes differences between userGoalCorpus and estimatedFireCorpus.
 * Does not make decisions about which is correct.
 * 
 * @param {number} userGoalCorpus - User-entered target
 * @param {number} estimatedFireCorpus - Mathematically derived target
 * @returns {Object} { userGoalCorpus, estimatedFireCorpus, difference, percentageDifference }
 */
export function corpusGoalDifference(userGoalCorpus, estimatedFireCorpus) {
  validateNonNegativeFinite(userGoalCorpus, 'userGoalCorpus');
  validateNonNegativeFinite(estimatedFireCorpus, 'estimatedFireCorpus');

  const difference = userGoalCorpus - estimatedFireCorpus;
  const percentageDifference = estimatedFireCorpus > 0
    ? (difference / estimatedFireCorpus) * 100
    : 0;

  return {
    userGoalCorpus,
    estimatedFireCorpus,
    difference,
    percentageDifference
  };
}

/**
 * Pure helper to aggregate investable assets for FIRE calculations.
 * Filters out NON_INVESTABLE assets or assets where includedInFireCorpus is false.
 * Decoupled from current liquid cash or goals.
 * 
 * @param {Array} assets - Array of Asset documents/objects
 * @returns {Object} { includedTotal, excludedTotal, includedAssets, excludedAssets }
 */
export function calculateInvestableCorpus(assets) {
  if (!Array.isArray(assets)) {
    throw new TypeError('assets must be an array');
  }

  let includedTotal = 0;
  let excludedTotal = 0;
  const includedAssets = [];
  const excludedAssets = [];

  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') {
      continue;
    }

    const value = asset.currentValue || 0;
    const included = asset.includedInFireCorpus === true && asset.assetClass !== 'NON_INVESTABLE';

    if (included) {
      includedTotal += value;
      includedAssets.push({ ...asset });
    } else {
      excludedTotal += value;
      excludedAssets.push({ ...asset });
    }
  }

  return {
    includedTotal,
    excludedTotal,
    includedAssets,
    excludedAssets
  };
}

/**
 * Projects total portfolio corpus at retirement.
 * 
 * @param {Object} params
 * @param {number} params.currentInvestableCorpus - Current investable assets
 * @param {number} params.monthlyContribution - Monthly saving amount
 * @param {string} [params.mode=CONTRIBUTION_MODE.REAL_CONSTANT] - Contribution mode
 * @param {number} [params.realAnnualReturn] - Real annual return rate (for REAL_CONSTANT mode)
 * @param {number} [params.nominalAnnualReturn] - Nominal annual return rate (for NOMINAL_FLAT mode)
 * @param {number} [params.inflationRate] - Annual inflation rate (for NOMINAL_FLAT mode)
 * @param {number} params.monthsToRetirement - Time until retirement in months
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {number} Projected corpus value in today's purchasing power (real terms)
 */
export function projectedCorpusAtRetirement({
  currentInvestableCorpus,
  monthlyContribution,
  mode = CONTRIBUTION_MODE.REAL_CONSTANT,
  realAnnualReturn,
  nominalAnnualReturn,
  inflationRate,
  monthsToRetirement,
  isBeginningOfMonth = false
}) {
  if (mode === CONTRIBUTION_MODE.NOMINAL_FLAT) {
    const result = futureValueNominalFlat({
      currentPrincipal: currentInvestableCorpus,
      monthlyContribution,
      nominalAnnualReturn,
      inflationRate,
      months: monthsToRetirement,
      isBeginningOfMonth
    });
    return result.totalFutureValueReal;
  }

  const result = futureValueRealConstant({
    currentPrincipal: currentInvestableCorpus,
    monthlyContribution,
    realAnnualReturn,
    months: monthsToRetirement,
    isBeginningOfMonth
  });
  return result.totalFutureValue;
}

/**
 * Calculates the number of months required to reach a target corpus.
 * Supports both REAL_CONSTANT and NOMINAL_FLAT contribution modes.
 * 
 * @param {Object} params
 * @param {number} params.currentPrincipal - PV starting amount
 * @param {number} params.monthlyContribution - Monthly contribution amount
 * @param {string} [params.mode=CONTRIBUTION_MODE.REAL_CONSTANT] - Contribution mode
 * @param {number} [params.annualRate] - Alias for realAnnualReturn (backwards compatibility)
 * @param {number} [params.realAnnualReturn] - Real expected return rate
 * @param {number} [params.nominalAnnualReturn] - Nominal expected return rate (for NOMINAL_FLAT)
 * @param {number} [params.inflationRate] - Inflation rate (for NOMINAL_FLAT)
 * @param {number} params.targetFutureValue - Target corpus in today's real purchasing power (FV)
 * @param {number} [params.maxMonths=MAX_PROJECTION_MONTHS] - Max projection horizon
 * @param {boolean} [params.isBeginningOfMonth=false] - Contribution timing
 * @returns {Object} { reached: boolean, months: number | null, projectedValue: number }
 */
export function monthsToTarget({
  currentPrincipal,
  monthlyContribution,
  mode = CONTRIBUTION_MODE.REAL_CONSTANT,
  annualRate,
  realAnnualReturn,
  nominalAnnualReturn,
  inflationRate,
  targetFutureValue,
  maxMonths = MAX_PROJECTION_MONTHS,
  isBeginningOfMonth = false
}) {
  validateNonNegativeFinite(currentPrincipal, 'currentPrincipal');
  validateNonNegativeFinite(monthlyContribution, 'monthlyContribution');
  validateNonNegativeFinite(targetFutureValue, 'targetFutureValue');

  if (currentPrincipal >= targetFutureValue) {
    return { reached: true, months: 0, projectedValue: currentPrincipal };
  }

  if (mode === CONTRIBUTION_MODE.NOMINAL_FLAT) {
    validateFinite(nominalAnnualReturn, 'nominalAnnualReturn');
    validateFinite(inflationRate, 'inflationRate');
    if (nominalAnnualReturn <= -1) throw new RangeError('nominalAnnualReturn must be greater than -1.0 (-100%)');
    if (inflationRate <= -1) throw new RangeError('inflationRate must be greater than -1.0 (-100%)');

    const monthlyNominalRate = monthlyRateFromAnnual(nominalAnnualReturn);
    let currentNominal = currentPrincipal;

    for (let m = 1; m <= maxMonths; m++) {
      if (isBeginningOfMonth) {
        currentNominal = (currentNominal + monthlyContribution) * (1 + monthlyNominalRate);
      } else {
        currentNominal = currentNominal * (1 + monthlyNominalRate) + monthlyContribution;
      }

      const realValue = currentNominal / Math.pow(1 + inflationRate, m / 12);
      if (realValue >= targetFutureValue) {
        return { reached: true, months: m, projectedValue: realValue };
      }
    }

    const finalReal = currentNominal / Math.pow(1 + inflationRate, maxMonths / 12);
    return { reached: false, months: null, projectedValueAtHorizon: finalReal };
  }

  // REAL_CONSTANT mode
  const effectiveRealRate = realAnnualReturn !== undefined ? realAnnualReturn : annualRate;
  validateFinite(effectiveRealRate, 'realAnnualReturn');
  if (effectiveRealRate <= -1) {
    throw new RangeError('realAnnualReturn must be greater than -1.0 (-100%)');
  }

  const monthlyRate = monthlyRateFromAnnual(effectiveRealRate);
  let currentValue = currentPrincipal;

  const monthlyGrowth = currentValue * monthlyRate;
  if (monthlyGrowth + monthlyContribution <= 0) {
    return { reached: false, months: null, projectedValueAtHorizon: currentValue };
  }

  for (let m = 1; m <= maxMonths; m++) {
    if (isBeginningOfMonth) {
      currentValue = (currentValue + monthlyContribution) * (1 + monthlyRate);
    } else {
      currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
    }

    if (currentValue >= targetFutureValue) {
      return { reached: true, months: m, projectedValue: currentValue };
    }
  }

  return { reached: false, months: null, projectedValueAtHorizon: currentValue };
}

/**
 * Calculates projected FIRE age based on months remaining.
 * 
 * @param {Object} params
 * @param {number} params.currentAge - Current age in years
 * @param {number} params.monthsFromNow - Duration in months
 * @returns {number} Age in years (fractional)
 */
export function projectedAge({ currentAge, monthsFromNow }) {
  validateNonNegativeFinite(currentAge, 'currentAge');
  validateNonNegativeFinite(monthsFromNow, 'monthsFromNow');
  return currentAge + monthsFromNow / 12;
}

/**
 * Calculates Emergency Fund Target amount:
 * target = monthlyEssentialSpending * targetMonths
 * 
 * @param {Object} params
 * @param {number} params.monthlyEssentialSpending - Essential expenditures
 * @param {number} params.targetMonths - Target safety duration in months
 * @returns {Object} { monthlyEssentialSpending, targetMonths, targetAmount }
 */
export function calculateEmergencyFundTarget({ monthlyEssentialSpending, targetMonths }) {
  validateNonNegativeFinite(monthlyEssentialSpending, 'monthlyEssentialSpending');
  validateNonNegativeFinite(targetMonths, 'targetMonths');

  return {
    monthlyEssentialSpending,
    targetMonths,
    targetAmount: monthlyEssentialSpending * targetMonths
  };
}

/**
 * Calculates Emergency Fund coverage months:
 * coverageMonths = emergencyLiquidAssets / monthlyEssentialSpending
 * 
 * @param {Object} params
 * @param {number} params.emergencyLiquidAssets - Explicitly supplied liquid emergency assets
 * @param {number} params.monthlyEssentialSpending - Essential expenditures
 * @returns {Object} { coverageMonths: number | null, noEssentialSpending: boolean }
 */
export function calculateEmergencyFundCoverage({ emergencyLiquidAssets, monthlyEssentialSpending }) {
  validateNonNegativeFinite(emergencyLiquidAssets, 'emergencyLiquidAssets');
  validateNonNegativeFinite(monthlyEssentialSpending, 'monthlyEssentialSpending');

  if (monthlyEssentialSpending === 0) {
    return {
      coverageMonths: null,
      noEssentialSpending: true
    };
  }

  return {
    coverageMonths: emergencyLiquidAssets / monthlyEssentialSpending,
    noEssentialSpending: false
  };
}

/**
 * Computes amortization schedules for recurring liabilities.
 * 
 * Quoted interest APR convention:
 *   monthlyRate = annualInterestRate / 12
 * Timings: Interest accrues during the month; payment settles at month-end.
 * 
 * @param {Object} params
 * @param {number} params.outstandingPrincipal - Principal balance (must be supplied)
 * @param {number} params.annualInterestRate - Nominal annual rate (APR)
 * @param {number} params.monthlyPayment - Scheduled monthly payment (EMI)
 * @param {number} [params.remainingTermMonths] - Optional target term comparison
 * @returns {Object} Amortization metadata & schedule list
 */
export function amortizeLiability({ outstandingPrincipal, annualInterestRate, monthlyPayment, remainingTermMonths = null }) {
  if (outstandingPrincipal === null || outstandingPrincipal === undefined) {
    throw new TypeError('outstandingPrincipal must be supplied to compute amortization');
  }
  validateNonNegativeFinite(outstandingPrincipal, 'outstandingPrincipal');
  validateNonNegativeFinite(monthlyPayment, 'monthlyPayment');
  validateFinite(annualInterestRate, 'annualInterestRate');
  if (annualInterestRate < 0 || annualInterestRate > 1) {
    throw new RangeError('annualInterestRate must be a decimal fraction between 0.0 and 1.0');
  }
  if (remainingTermMonths !== null && (!Number.isInteger(remainingTermMonths) || remainingTermMonths < 0)) {
    throw new TypeError('remainingTermMonths must be a non-negative integer or null');
  }

  const schedule = [];
  let currentPrincipal = outstandingPrincipal;
  const monthlyRate = annualInterestRate / 12;

  let totalInterest = 0;
  let totalPaid = 0;
  let monthsUsed = 0;
  const warnings = [];

  if (currentPrincipal === 0) {
    return { paidOff: true, monthsUsed: 0, totalInterest: 0, totalPaid: 0, schedule: [], warnings };
  }

  // Detect negative amortization (interest grows faster than the payment)
  if (annualInterestRate > 0 && monthlyPayment <= currentPrincipal * monthlyRate) {
    throw new RangeError('Monthly payment is insufficient to cover monthly interest. Negative amortization detected.');
  }

  for (let m = 1; m <= MAX_PROJECTION_MONTHS; m++) {
    const interest = currentPrincipal * monthlyRate;
    let payment = monthlyPayment;
    let principalPaid = payment - interest;

    if (currentPrincipal + interest <= payment) {
      payment = currentPrincipal + interest;
      principalPaid = currentPrincipal;
      currentPrincipal = 0;
    } else {
      currentPrincipal -= principalPaid;
    }

    totalInterest += interest;
    totalPaid += payment;
    monthsUsed = m;

    schedule.push({
      month: m,
      openingPrincipal: Math.round((currentPrincipal + principalPaid) * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principalPaid: Math.round(principalPaid * 100) / 100,
      payment: Math.round(payment * 100) / 100,
      closingPrincipal: Math.round(currentPrincipal * 100) / 100
    });

    if (currentPrincipal <= EPSILON) {
      break;
    }
  }

  const paidOff = currentPrincipal <= EPSILON;
  if (!paidOff) {
    warnings.push(`Liability could not be fully amortized within the maximum limit of ${MAX_PROJECTION_MONTHS} months`);
  }

  if (remainingTermMonths !== null && monthsUsed !== remainingTermMonths) {
    warnings.push(`Amortization path completes in ${monthsUsed} months, conflicting with the remaining term of ${remainingTermMonths} months`);
  }

  return {
    paidOff,
    monthsUsed,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    schedule,
    warnings
  };
}
