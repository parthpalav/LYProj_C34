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
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_WITHDRAWAL_RATE,
  DEFAULT_LIFESTYLE_RATIO,
  DEFAULT_EMERGENCY_MONTHS
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
  const spendingWindowMonths = options.spendingWindowMonths || 6;

  const user = data.user || {};
  const incomes = Array.isArray(data.incomes) ? data.incomes : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const liabilities = Array.isArray(data.liabilities) ? data.liabilities : [];

  const limitations = [];
  const explanationFacts = [];

  // -------------------------------------------------------------
  // 1. LIABILITIES & DEBT SERVICE
  // -------------------------------------------------------------
  const activeLiabilities = liabilities.filter(l => l && l.status !== 'deleted');
  let monthlyLiabilityService = 0;
  let knownOutstandingPrincipal = 0;
  let unknownPrincipalCount = 0;
  const liabilitiesSummary = [];

  for (const l of activeLiabilities) {
    const amt = Number(l.amount) || 0;
    let monthlyAmount = amt;
    if (l.frequency === 'yearly') monthlyAmount = amt / 12;
    else if (l.frequency === 'weekly') monthlyAmount = (amt * 52) / 12;
    else if (l.frequency === 'daily') monthlyAmount = (amt * 365) / 12;

    monthlyLiabilityService += monthlyAmount;

    if (l.outstandingBalance !== null && l.outstandingBalance !== undefined && Number.isFinite(Number(l.outstandingBalance))) {
      knownOutstandingPrincipal += Number(l.outstandingBalance);
    } else {
      unknownPrincipalCount++;
    }

    liabilitiesSummary.push({
      id: l.id || l._id?.toString(),
      name: l.name,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      frequency: l.frequency,
      outstandingBalance: l.outstandingBalance ?? null,
      interestRate: l.interestRate ?? null,
      remainingTermMonths: l.remainingTermMonths ?? null
    });
  }

  if (unknownPrincipalCount > 0) {
    limitations.push(`${unknownPrincipalCount} active liability(ies) lack outstanding balance; net worth may be incomplete.`);
  }

  // -------------------------------------------------------------
  // 2. TRANSACTION CONSUMPTION & INVESTMENT CASH FLOWS
  // -------------------------------------------------------------
  // Compute trailing window for spending averages
  const spendingCutoff = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth() - spendingWindowMonths,
    1
  ));

  const validTxs = transactions.filter(t => {
    if (!t || !t.timestamp) return false;
    const d = new Date(t.timestamp);
    return !isNaN(d.getTime()) && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0;
  });

  const recentTxs = validTxs.filter(t => new Date(t.timestamp) >= spendingCutoff);
  const txsToUse = recentTxs.length > 0 ? recentTxs : validTxs;

  // Group transactions by calendar month to get true monthly averages
  const monthlySpendingMap = new Map();

  for (const t of txsToUse) {
    const d = new Date(t.timestamp);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthlySpendingMap.has(key)) {
      monthlySpendingMap.set(key, { needs: 0, wants: 0, investments: 0, debtServiceTxs: 0 });
    }
    const bucket = monthlySpendingMap.get(key);
    const amt = Number(t.amount);

    if (isDebtService(t)) {
      bucket.debtServiceTxs += amt;
    } else if (isConsumption(t)) {
      if (t.type === 'Need') bucket.needs += amt;
      else if (t.type === 'Want') bucket.wants += amt;
    } else if (isInvestment(t)) {
      bucket.investments += amt;
    }
  }

  const activeMonthsCount = Math.max(1, monthlySpendingMap.size);
  let totalNeeds = 0;
  let totalWants = 0;
  let totalInvestments = 0;

  for (const bucket of monthlySpendingMap.values()) {
    totalNeeds += bucket.needs;
    totalWants += bucket.wants;
    totalInvestments += bucket.investments;
  }

  const averageMonthlyNeeds = totalNeeds / activeMonthsCount;
  const averageMonthlyWants = totalWants / activeMonthsCount;
  const observedAverageMonthlyInvestment = totalInvestments / activeMonthsCount;

  // Invariant: Needs consumption strictly excludes liability-linked transactions.
  // Scheduled liability service is added separately so that debt service is counted exactly once.
  const needsConsumption = averageMonthlyNeeds;
  const totalEssentialSpending = needsConsumption + monthlyLiabilityService;

  if (validTxs.length === 0) {
    limitations.push('No transaction history found; spending and investment cash flows are unpopulated.');
  }

  // -------------------------------------------------------------
  // 3. ASSETS, FIRE CORPUS & LIQUID BUFFER
  // -------------------------------------------------------------
  const investableResult = calculateInvestableCorpus(assets);
  const fireInvestableCorpus = investableResult.includedTotal;

  let totalAssetValue = 0;
  let liquidBuffer = 0;

  for (const a of assets) {
    if (!a || typeof a !== 'object') continue;
    const val = Number(a.currentValue) || 0;
    totalAssetValue += val;

    // Explicit qualifying liquid emergency assets (cash equivalents, semi-liquid reserves)
    const isLiquid = (
      a.assetClass === 'SEMI_LIQUID' ||
      a.assetType?.toLowerCase() === 'cash' ||
      a.assetType?.toLowerCase() === 'bank' ||
      a.assetType?.toLowerCase() === 'savings' ||
      a.assetType?.toLowerCase() === 'liquid fund'
    ) && a.liquidity !== 'locked' && a.liquidity !== 'restricted' && a.assetClass !== 'NON_INVESTABLE';

    if (isLiquid) {
      liquidBuffer += val;
    }
  }

  const knownNetWorth = totalAssetValue - knownOutstandingPrincipal;

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
  // 6. RETIREMENT & FIRE PROJECTIONS
  // -------------------------------------------------------------
  // Lifestyle spending basis: Needs + Wants (excluding liability payments that terminate before retirement)
  const currentAnnualLifestyleSpending = (averageMonthlyNeeds + averageMonthlyWants) * 12;

  const expectedReturnRate = user.expectedReturnRate ?? DEFAULT_RETURN_RATE;
  const expectedInflationRate = user.expectedInflationRate ?? DEFAULT_INFLATION_RATE;
  const expectedWithdrawalRate = user.expectedWithdrawalRate ?? DEFAULT_WITHDRAWAL_RATE;
  const lifestyleAdjustmentRatio = user.lifestyleAdjustmentRatio ?? DEFAULT_LIFESTYLE_RATIO;
  const realAnnualReturn = realReturn(expectedReturnRate, expectedInflationRate);

  const fireCorpusResult = calculateFireCorpus({
    currentAnnualLifestyleSpending,
    lifestyleAdjustmentRatio,
    safeWithdrawalRate: expectedWithdrawalRate
  });
  const estimatedFireCorpus = fireCorpusResult.fireCorpus;
  const userGoalCorpus = Number(user.retirementCorpusGoal) || 0;
  const goalDifference = userGoalCorpus > 0
    ? corpusGoalDifference(userGoalCorpus, estimatedFireCorpus)
    : null;

  // Retirement Age & Horizon
  let currentAge = null;
  if (user.age !== null && user.age !== undefined && Number.isFinite(Number(user.age))) {
    currentAge = Number(user.age);
  } else if (user.dateOfBirth) {
    const dob = new Date(user.dateOfBirth);
    if (!isNaN(dob.getTime())) {
      const ageDiff = referenceDate.getTime() - dob.getTime();
      currentAge = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  const retirementAge = user.retirementAge ?? 60;
  let monthsUntilRetirement = null;
  let projectedCorpus = null;
  let requiredContributionForEstimatedFire = null;
  let requiredContributionForUserGoal = null;
  let contributionGap = null;
  let projectedFire = null;
  let projectedFireAge = null;

  const monthlyContributionUsed = options.monthlyContributionOverride !== undefined
    ? Number(options.monthlyContributionOverride)
    : observedAverageMonthlyInvestment;

  if (currentAge === null) {
    limitations.push('User age is not specified; retirement timeline and horizon cannot be calculated.');
  } else if (currentAge >= retirementAge) {
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
    limitations.push('User has already reached or passed the target retirement age.');
  } else {
    monthsUntilRetirement = Math.round((retirementAge - currentAge) * 12);

    projectedCorpus = projectedCorpusAtRetirement({
      currentInvestableCorpus: fireInvestableCorpus,
      monthlyContribution: monthlyContributionUsed,
      mode: contributionMode,
      realAnnualReturn,
      nominalAnnualReturn: expectedReturnRate,
      inflationRate: expectedInflationRate,
      monthsToRetirement: monthsUntilRetirement
    });

    if (contributionMode === CONTRIBUTION_MODE.NOMINAL_FLAT) {
      requiredContributionForEstimatedFire = requiredNominalFlatContribution({
        currentPrincipal: fireInvestableCorpus,
        targetFutureValueReal: estimatedFireCorpus,
        nominalAnnualReturn: expectedReturnRate,
        inflationRate: expectedInflationRate,
        months: monthsUntilRetirement
      });
      requiredContributionForUserGoal = userGoalCorpus > 0
        ? requiredNominalFlatContribution({
            currentPrincipal: fireInvestableCorpus,
            targetFutureValueReal: userGoalCorpus,
            nominalAnnualReturn: expectedReturnRate,
            inflationRate: expectedInflationRate,
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
      nominalAnnualReturn: expectedReturnRate,
      inflationRate: expectedInflationRate,
      targetFutureValue: estimatedFireCorpus
    });

    if (projectedFire.reached && projectedFire.months !== null) {
      projectedFireAge = currentAge + (projectedFire.months / 12);
    }
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

  // -------------------------------------------------------------
  // 8. ASSEMBLE COMPLETE PREDICTABILITY SNAPSHOT
  // -------------------------------------------------------------
  return {
    generatedAt: referenceDate.toISOString(),
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
    retirement: {
      currentAge,
      retirementAge,
      monthsUntilRetirement,
      assumptions: {
        nominalReturn: expectedReturnRate,
        inflation: expectedInflationRate,
        realReturn: realAnnualReturn,
        withdrawalRate: expectedWithdrawalRate,
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
    },
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
