/**
 * server/services/PredictabilityService.js
 * 
 * Deterministic Predictability Engine Orchestration Layer.
 * Assembles existing financial data into a single explainable financial projection snapshot.
 * 
 * Reuses tested financial primitives:
 *  - financialAccounting.js (cash-flow taxonomy, consumption vs debt separation)
 *  - financialMath.js (Fisher real return, EAR/APR compounding, nominal-flat projections, reverse solvers, SWR)
 *  - incomeAnalytics.js (calendar-month grouping, CV, reliable income, gaps, zero-month analysis, resilience)
 * 
 * Core Invariants:
 *  - Zero invented formulas: orchestration only.
 *  - Exact single-count of debt service (liability-linked transactions excluded from consumption Needs).
 *  - Explicit separation between User.retirementCorpusGoal and calculated estimatedFireCorpus.
 *  - Nominal flat contribution default (NOMINAL_FLAT).
 *  - No advice/recommendations or LLM calls.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Income from '../models/Income.js';
import Transaction from '../models/Transaction.js';
import Asset from '../models/Asset.js';
import Liability from '../models/Liability.js';
import { isConsumption, isInvestment, isDebtService } from '../utils/financialAccounting.js';
import {
  realReturn,
  calculateFireCorpus,
  corpusGoalDifference,
  calculateInvestableCorpus,
  projectedCorpusAtRetirement,
  monthsToTarget,
  requiredNominalFlatContribution,
  requiredRealConstantContribution,
  calculateEmergencyFundTarget,
  CONTRIBUTION_MODE
} from '../utils/financialMath.js';
import {
  analyzeIncomeResilience,
  DATA_QUALITY_LEVEL
} from '../utils/incomeAnalytics.js';
import { resolveForecastInputs } from '../utils/forecastResolver.js';
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_WITHDRAWAL_RATE,
  DEFAULT_LIFESTYLE_RATIO,
  DEFAULT_EMERGENCY_MONTHS,
  DEFAULT_SCENARIOS
} from '../config/financialRules.js';

/**
 * Pure deterministic snapshot builder.
 * Operates entirely in memory on normalized data without performing database queries.
 * 
 * @param {Object} data
 * @param {Object} data.user - User document or plain object
 * @param {Array<Object>} [data.incomes=[]] - Historical income records
 * @param {Array<Object>} [data.transactions=[]] - Historical transaction records
 * @param {Array<Object>} [data.assets=[]] - User asset records
 * @param {Array<Object>} [data.liabilities=[]] - User liability records
 * @param {Object} [options={}]
 * @param {Date|string} [options.referenceDate] - Override current date for testing
 * @param {string} [options.contributionMode=CONTRIBUTION_MODE.NOMINAL_FLAT] - Contribution projection mode
 * @param {number} [options.monthlyContributionOverride] - Optional override for monthly savings
 * @param {number} [options.spendingWindowMonths=6] - Trailing window in months for spending analysis
 * @returns {Object} Structured predictability snapshot
 */
export function buildPredictabilitySnapshot(data = {}, options = {}) {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const contributionMode = options.contributionMode || CONTRIBUTION_MODE.NOMINAL_FLAT;

  const resolved = resolveForecastInputs(data, options);

  const {
    user,
    assets = Array.isArray(data.assets) ? data.assets : [],
    activeLiabilities,
    liabilitiesSummary,
    monthlyLiabilityService,
    knownOutstandingPrincipal,
    unknownPrincipalCount,
    averageMonthlyNeeds,
    averageMonthlyWants,
    totalEssentialSpending,
    observedAverageMonthlyInvestment,
    monthlyContributionUsed,
    activeMonthsCount,
    fireInvestableCorpus,
    liquidBuffer,
    totalAssetValue,
    knownNetWorth,
    investableResult,
    currentAge,
    retirementAge,
    monthsUntilRetirement,
    forecastStatus,
    liabilityOverhang
  } = resolved;

  const incomes = Array.isArray(data.incomes) ? data.incomes : [];
  const needsConsumption = averageMonthlyNeeds;

  const limitations = [];
  const explanationFacts = [];

  if (unknownPrincipalCount > 0) {
    limitations.push(`${unknownPrincipalCount} active liability(ies) lack outstanding balance or maturity; net worth and overhang may be incomplete.`);
  }

  if (activeMonthsCount === 0 && totalEssentialSpending === 0) {
    limitations.push('No transaction history found; spending and investment cash flows are unpopulated.');
  }

  if (assets.length === 0) {
    limitations.push('No asset records found; FIRE investable corpus starts at ₹0.');
  }
  if (liquidBuffer === 0) {
    limitations.push('No explicit liquid emergency assets identified; liquid buffer is ₹0.');
  }

  // -------------------------------------------------------------
  // 4. IRREGULAR-INCOME ANALYTICS INTEGRATION
  // -------------------------------------------------------------
  const incomeSnapshot = analyzeIncomeResilience({
    incomeEvents: incomes,
    essentialMonthlySpend: totalEssentialSpending,
    liquidBuffer: liquidBuffer,
    currentMonthIncome: options.currentMonthIncome ?? null
  });

  if (incomes.length === 0) {
    limitations.push('No income records found; income metrics are unpopulated.');
  } else if (incomeSnapshot.dataQuality.dataQualityLevel !== DATA_QUALITY_LEVEL.HIGH) {
    limitations.push(...incomeSnapshot.dataQuality.limitations);
  }

  // -------------------------------------------------------------
  // 5. EMERGENCY FUND TARGET & COVERAGE
  // -------------------------------------------------------------
  const emergencyFundTargetMonths = user.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS;
  const efTarget = calculateEmergencyFundTarget({
    monthlyEssentialSpending: totalEssentialSpending,
    targetMonths: emergencyFundTargetMonths
  });

  const emergencyCoverageMonths = totalEssentialSpending > 0
    ? liquidBuffer / totalEssentialSpending
    : null;

  const emergencyFundingGap = Math.max(0, efTarget.targetAmount - liquidBuffer);

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 6. RETIREMENT & FIRE PROJECTIONS (SCENARIO ENGINE V1)
  // -------------------------------------------------------------
  // Lifestyle spending basis: Needs + Wants (excluding liability payments that terminate before retirement)
  const currentAnnualLifestyleSpending = (averageMonthlyNeeds + averageMonthlyWants) * 12;

  const baseReturnRate = user.expectedReturnRate ?? DEFAULT_RETURN_RATE;
  const baseInflationRate = user.expectedInflationRate ?? DEFAULT_INFLATION_RATE;
  const baseWithdrawalRate = user.expectedWithdrawalRate ?? DEFAULT_WITHDRAWAL_RATE;
  const lifestyleAdjustmentRatio = user.lifestyleAdjustmentRatio ?? DEFAULT_LIFESTYLE_RATIO;

  const userGoalCorpus = Number(user.retirementCorpusGoal) || 0;

  if (!forecastStatus.available) {
    forecastStatus.missingInputs.forEach(code => {
      limitations.push(`Forecast unavailable: ${code}`);
    });
  }

  // Pure retirement projection helper executed across scenario profiles
  const runProjection = (nomRate, infRate, swrRate, label, id) => {
    if (!forecastStatus.available) {
      return null;
    }

    const realAnnualReturn = realReturn(nomRate, infRate);
    const fireCorpusResult = calculateFireCorpus({
      currentAnnualLifestyleSpending,
      lifestyleAdjustmentRatio,
      safeWithdrawalRate: swrRate
    });
    const baseFireCorpus = fireCorpusResult.fireCorpus;
    const estimatedFireCorpus = baseFireCorpus + liabilityOverhang;

    const goalDifference = userGoalCorpus > 0
      ? corpusGoalDifference(userGoalCorpus, estimatedFireCorpus)
      : null;

    let monthsUntilRetirement = null;
    let projectedCorpus = null;
    let requiredContributionForEstimatedFire = null;
    let requiredContributionForUserGoal = null;
    let contributionGap = null;
    let projectedFire = null;
    let projectedFireAge = null;

    if (currentAge !== null) {
      if (currentAge >= retirementAge) {
        monthsUntilRetirement = 0;
        projectedCorpus = fireInvestableCorpus;
        requiredContributionForEstimatedFire = Math.max(0, estimatedFireCorpus - fireInvestableCorpus);
        requiredContributionForUserGoal = userGoalCorpus > 0 ? Math.max(0, userGoalCorpus - fireInvestableCorpus) : 0;
        contributionGap = Math.max(0, requiredContributionForEstimatedFire - monthlyContributionUsed);
        projectedFire = {
          reached: fireInvestableCorpus >= estimatedFireCorpus,
          months: fireInvestableCorpus >= estimatedFireCorpus ? 0 : null,
          projectedValue: fireInvestableCorpus
        };
        projectedFireAge = fireInvestableCorpus >= estimatedFireCorpus ? currentAge : null;
      } else {
        monthsUntilRetirement = Math.round((retirementAge - currentAge) * 12);

        projectedCorpus = projectedCorpusAtRetirement({
          currentInvestableCorpus: fireInvestableCorpus,
          monthlyContribution: monthlyContributionUsed,
          mode: contributionMode,
          realAnnualReturn,
          nominalAnnualReturn: nomRate,
          inflationRate: infRate,
          monthsToRetirement: monthsUntilRetirement
        });

        if (contributionMode === CONTRIBUTION_MODE.NOMINAL_FLAT) {
          requiredContributionForEstimatedFire = requiredNominalFlatContribution({
            currentPrincipal: fireInvestableCorpus,
            targetFutureValueReal: estimatedFireCorpus,
            nominalAnnualReturn: nomRate,
            inflationRate: infRate,
            months: monthsUntilRetirement
          });
          requiredContributionForUserGoal = userGoalCorpus > 0
            ? requiredNominalFlatContribution({
                currentPrincipal: fireInvestableCorpus,
                targetFutureValueReal: userGoalCorpus,
                nominalAnnualReturn: nomRate,
                inflationRate: infRate,
                months: monthsUntilRetirement
              })
            : 0;
        } else {
          requiredContributionForEstimatedFire = requiredRealConstantContribution({
            currentPrincipal: fireInvestableCorpus,
            targetFutureValueReal: estimatedFireCorpus,
            realAnnualReturn,
            months: monthsUntilRetirement
          });
          requiredContributionForUserGoal = userGoalCorpus > 0
            ? requiredRealConstantContribution({
                currentPrincipal: fireInvestableCorpus,
                targetFutureValueReal: userGoalCorpus,
                realAnnualReturn,
                months: monthsUntilRetirement
              })
            : 0;
        }

        contributionGap = requiredContributionForEstimatedFire - monthlyContributionUsed;

        projectedFire = monthsToTarget({
          currentPrincipal: fireInvestableCorpus,
          monthlyContribution: monthlyContributionUsed,
          mode: contributionMode,
          realAnnualReturn,
          nominalAnnualReturn: nomRate,
          inflationRate: infRate,
          targetFutureValue: estimatedFireCorpus
        });

        if (projectedFire.reached && projectedFire.months !== null) {
          projectedFireAge = currentAge + (projectedFire.months / 12);
        }
      }
    }

    return {
      id,
      label,
      currentAge,
      retirementAge,
      monthsUntilRetirement,
      assumptions: {
        nominalReturn: nomRate,
        inflation: infRate,
        realReturn: realAnnualReturn,
        withdrawalRate: swrRate,
        lifestyleAdjustmentRatio,
        contributionMode
      },
      currentAnnualLifestyleSpending,
      estimatedFireCorpus,
      userGoalCorpus,
      goalDifference,
      monthlyContributionUsed,
      projectedCorpusAtRetirement: projectedCorpus,
      requiredMonthlyContributionForEstimatedFire: requiredContributionForEstimatedFire,
      requiredMonthlyContributionForUserGoal: requiredContributionForUserGoal,
      contributionGap,
      projectedFire: {
        reached: projectedFire ? projectedFire.reached : false,
        months: projectedFire ? projectedFire.months : null,
        projectedAge: projectedFireAge
      }
    };
  };

  const roundRate = (val) => Math.round(val * 10000) / 10000;

  // Base scenario (current profile defaults)
  const baseRetirement = runProjection(baseReturnRate, baseInflationRate, baseWithdrawalRate, 'Base', 'base');

  let scenarios = null;
  let retirement = null;
  let estimatedFireCorpus = 0;
  let projectedCorpus = null;

  if (forecastStatus.available) {
    // Conservative scenario (lower nominal return, higher inflation; SWR remains stable policy)
    const consNominal = Math.max(0, roundRate(baseReturnRate + DEFAULT_SCENARIOS.CONSERVATIVE.nominalReturnOffset));
    const consInflation = Math.max(0.005, roundRate(baseInflationRate + DEFAULT_SCENARIOS.CONSERVATIVE.inflationOffset));
    const consSWR = Math.max(0.01, roundRate(baseWithdrawalRate + DEFAULT_SCENARIOS.CONSERVATIVE.withdrawalRateOffset));
    const conservativeRetirement = runProjection(consNominal, consInflation, consSWR, 'Conservative', 'conservative');

    // Optimistic scenario (higher nominal return, lower inflation; SWR remains stable policy)
    const optNominal = Math.max(0, roundRate(baseReturnRate + DEFAULT_SCENARIOS.OPTIMISTIC.nominalReturnOffset));
    const optInflation = Math.max(0.005, roundRate(baseInflationRate + DEFAULT_SCENARIOS.OPTIMISTIC.inflationOffset));
    const optSWR = Math.max(0.01, roundRate(baseWithdrawalRate + DEFAULT_SCENARIOS.OPTIMISTIC.withdrawalRateOffset));
    const optimisticRetirement = runProjection(optNominal, optInflation, optSWR, 'Optimistic', 'optimistic');

    scenarios = {
      conservative: conservativeRetirement,
      base: baseRetirement,
      optimistic: optimisticRetirement
    };

    retirement = baseRetirement;
    estimatedFireCorpus = baseRetirement.estimatedFireCorpus;
    projectedCorpus = baseRetirement.projectedCorpusAtRetirement;
  }


  // -------------------------------------------------------------
  // 7. DETERMINISTIC EXPLAINABILITY FACTS
  // -------------------------------------------------------------
  const cv = incomeSnapshot.variability.coefficientOfVariation;
  if (cv !== null) {
    let cvCode = 'INCOME_VARIABILITY_MODERATE';
    if (cv === 0) cvCode = 'INCOME_VARIABILITY_ZERO';
    else if (cv < 0.2) cvCode = 'INCOME_VARIABILITY_LOW';
    else if (cv >= 0.5) cvCode = 'INCOME_VARIABILITY_HIGH';

    explanationFacts.push({
      code: cvCode,
      metric: 'coefficientOfVariation',
      value: cv
    });
  }

  if (incomeSnapshot.resilience.essentialCoverageRatio !== null) {
    explanationFacts.push({
      code: incomeSnapshot.resilience.isCoverageAdequate
        ? 'ESSENTIALS_COVERED_BY_CONSERVATIVE_INCOME'
        : 'ESSENTIALS_UNCOVERED_BY_CONSERVATIVE_INCOME',
      metric: 'essentialCoverageRatio',
      value: incomeSnapshot.resilience.essentialCoverageRatio
    });
  }

  if (emergencyCoverageMonths !== null) {
    explanationFacts.push({
      code: emergencyCoverageMonths >= 3 ? 'BUFFER_RUNWAY_ADEQUATE' : 'BUFFER_RUNWAY_LOW',
      metric: 'emergencyCoverageMonths',
      value: emergencyCoverageMonths
    });
  }

  if (projectedCorpus !== null && estimatedFireCorpus > 0) {
    explanationFacts.push({
      code: projectedCorpus >= estimatedFireCorpus ? 'RETIREMENT_ON_TRACK' : 'RETIREMENT_CONTRIBUTION_GAP',
      metric: 'projectedCorpusAtRetirement',
      value: projectedCorpus
    });
  }

  if (emergencyFundingGap === 0) {
    explanationFacts.push({
      code: 'EMERGENCY_FUND_FULLY_FUNDED',
      metric: 'fundingGap',
      value: 0
    });
  } else {
    explanationFacts.push({
      code: 'EMERGENCY_FUND_DEFICIT',
      metric: 'fundingGap',
      value: emergencyFundingGap
    });
  }

  if (forecastStatus.warnings.includes('UNKNOWN_LIABILITY_MATURITY_EXCLUDED')) {
    explanationFacts.push({
      code: 'UNKNOWN_LIABILITY_MATURITY_EXCLUDED',
      metric: 'unknownPrincipalCount',
      value: resolved.unknownPrincipalCount
    });
  }

  if (liabilityOverhang > 0) {
    explanationFacts.push({
      code: 'LIABILITY_OVERHANG_INCLUDED',
      metric: 'liabilityOverhang',
      value: liabilityOverhang
    });
  }

  // -------------------------------------------------------------
  // 8. ASSEMBLE COMPLETE PREDICTABILITY SNAPSHOT
  // -------------------------------------------------------------
  return {
    generatedAt: referenceDate.toISOString(),
    forecastStatus,
    dataQuality: {
      incomeDataQuality: incomeSnapshot.dataQuality,
      transactionMonthsObserved: activeMonthsCount,
      assetsRecorded: assets.length,
      liabilitiesRecorded: activeLiabilities.length
    },
    currentState: {
      currentBalance: Number(user.currentBalance) || 0,
      averageMonthlyNeeds,
      averageMonthlyWants,
      needsConsumption,
      liabilityService: monthlyLiabilityService,
      totalEssentialSpending,
      observedAverageMonthlyInvestment
    },
    income: {
      meanMonthlyIncome: incomeSnapshot.centralIncome.meanMonthlyIncome,
      medianMonthlyIncome: incomeSnapshot.centralIncome.medianMonthlyIncome,
      reliableMonthlyIncome: incomeSnapshot.centralIncome.reliableMonthlyIncome,
      percentileUsed: incomeSnapshot.centralIncome.percentileUsed,
      standardDeviation: incomeSnapshot.variability.standardDeviation,
      coefficientOfVariation: incomeSnapshot.variability.coefficientOfVariation,
      zeroIncomeMonthsCount: incomeSnapshot.variability.zeroIncomeMonthsCount,
      zeroIncomeMonthRatio: incomeSnapshot.variability.zeroIncomeMonthRatio,
      longestConsecutiveZeroIncomeMonths: incomeSnapshot.variability.longestConsecutiveZeroIncomeMonths,
      worstRollingQuarter: incomeSnapshot.downside,
      gapAnalysis: incomeSnapshot.timing
    },
    resilience: {
      essentialCoverageRatio: incomeSnapshot.resilience.essentialCoverageRatio,
      isCoverageAdequate: incomeSnapshot.resilience.isCoverageAdequate,
      bufferRunwayMonths: incomeSnapshot.resilience.bufferRunwayMonths,
      liquidBuffer
    },
    assets: {
      totalAssetValue,
      fireInvestableCorpus,
      liquidBuffer,
      knownNetWorth,
      includedCount: investableResult.includedAssets.length,
      excludedCount: investableResult.excludedAssets.length,
      includedAssets: investableResult.includedAssets,
      excludedAssets: investableResult.excludedAssets
    },
    liabilities: {
      activeCount: activeLiabilities.length,
      monthlyLiabilityService,
      knownOutstandingPrincipal,
      unknownPrincipalCount,
      liabilitiesSummary
    },
    emergencyFund: {
      targetMonths: emergencyFundTargetMonths,
      targetAmount: efTarget.targetAmount,
      knownLiquidEmergencyAssets: liquidBuffer,
      coverageMonths: emergencyCoverageMonths,
      fundingGap: emergencyFundingGap
    },
    retirement: baseRetirement,
    scenarios,
    explanationFacts,
    limitations
  };
}

/**
 * Async data retriever and orchestrator.
 * Safely resolves user records from MongoDB and invokes buildPredictabilitySnapshot.
 * 
 * @param {string|Object} userIdOrUser - User ID string or Mongoose User document
 * @param {Object} [options={}] - Snapshot options
 * @returns {Promise<Object>} Complete predictability snapshot
 */
export async function getPredictabilitySnapshot(userIdOrUser, options = {}) {
  let user = null;
  let uid = null;

  if (typeof userIdOrUser === 'object' && userIdOrUser !== null) {
    user = userIdOrUser;
    uid = user.id || user._id?.toString();
  } else if (typeof userIdOrUser === 'string') {
    uid = userIdOrUser;
    const conditions = [{ id: uid }];
    if (mongoose.Types.ObjectId.isValid(uid)) {
      conditions.push({ _id: uid });
    }
    user = await User.findOne({ $or: conditions }).lean();
  }

  if (!user) {
    throw new Error(`User not found for ID: ${userIdOrUser}`);
  }

  const queryUid = user.id || uid;

  const [incomes, transactions, assets, liabilities] = await Promise.all([
    Income.find({ userId: queryUid }).lean(),
    Transaction.find({ userId: queryUid }).lean(),
    Asset.find({ userId: queryUid }).lean(),
    Liability.find({ userId: queryUid, status: { $ne: 'deleted' } }).lean()
  ]);

  return buildPredictabilitySnapshot({
    user,
    incomes,
    transactions,
    assets,
    liabilities
  }, options);
}
