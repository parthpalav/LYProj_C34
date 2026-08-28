import { isConsumption, isInvestment, isDebtService } from './financialAccounting.js';
import { calculateInvestableCorpus, calculateInvestableWeightedReturn } from './financialMath.js';
import { DEFAULT_RETURN_RATE } from '../config/financialRules.js';

/**
 * server/utils/forecastResolver.js
 * 
 * Centralized resolver for deterministic forecast inputs.
 * Normalizes liabilities, determines data sufficiency, and computes liability overhang.
 */

export function normalizeLiabilityFrequency(amount, frequency) {
  const amt = Number(amount) || 0;
  if (frequency === 'yearly') return amt / 12;
  if (frequency === 'weekly') return (amt * 52) / 12;
  if (frequency === 'daily') return (amt * 365) / 12;
  return amt; // defaults to monthly
}

export function deriveLiabilityRemainingTerm(outstandingBalance, annualInterestRate, monthlyPayment) {
  const P = Number(outstandingBalance);
  const rAnnual = Number(annualInterestRate);
  const PMT = Number(monthlyPayment);

  if (!Number.isFinite(P) || !Number.isFinite(rAnnual) || !Number.isFinite(PMT) || P <= 0 || PMT <= 0 || rAnnual <= 0) {
    return null;
  }

  const r = rAnnual / 12;
  // If payment doesn't cover interest, it never amortizes
  if (PMT <= P * r) {
    return null; 
  }

  const term = -Math.log(1 - (P * r) / PMT) / Math.log(1 + r);
  return Math.ceil(term);
}

export function calculateLiabilityOverhang(liabilities, monthsUntilRetirement) {
  let overhang = 0;
  let unknownCount = 0;

  for (const l of liabilities) {
    const hasExplicitTerm = l.remainingTermMonths !== null && l.remainingTermMonths !== undefined && Number.isFinite(Number(l.remainingTermMonths));
    let term = hasExplicitTerm 
      ? Number(l.remainingTermMonths) 
      : deriveLiabilityRemainingTerm(l.outstandingBalance, l.interestRate, l.monthlyAmount);

    if (term === null) {
      unknownCount++;
      continue;
    }

    if (term <= monthsUntilRetirement) {
      continue; // fully paid off before retirement
    }

    const P = Number(l.outstandingBalance);
    const PMT = Number(l.monthlyAmount);
    const rAnnual = Number(l.interestRate);

    if (!Number.isFinite(P) || !Number.isFinite(rAnnual) || rAnnual <= 0) {
      unknownCount++;
      continue;
    }

    const r = rAnnual / 12;
    // Remaining balance formula after T payments:
    // Balance(T) = P * (1+r)^T - PMT * [ (1+r)^T - 1 ] / r
    const T = monthsUntilRetirement;
    const futureBalance = P * Math.pow(1 + r, T) - PMT * (Math.pow(1 + r, T) - 1) / r;
    
    if (futureBalance > 0) {
      overhang += futureBalance;
    }
  }

  return {
    liabilityOverhang: Math.max(0, overhang),
    unknownMaturityCount: unknownCount
  };
}

export function resolveForecastInputs(data, options = {}) {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const spendingWindowMonths = options.spendingWindowMonths || 6;

  const user = data.user || {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const liabilities = Array.isArray(data.liabilities) ? data.liabilities : [];

  // 1. Process Liabilities
  const activeLiabilities = liabilities.filter(l => l && l.status !== 'deleted');
  let monthlyLiabilityService = 0;
  let knownOutstandingPrincipal = 0;
  let unknownPrincipalCount = 0;
  const liabilitiesSummary = [];

  for (const l of activeLiabilities) {
    const monthlyAmount = normalizeLiabilityFrequency(l.amount, l.frequency);
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

  // 2. Process Transactions (Trailing Window)
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
  const totalEssentialSpending = averageMonthlyNeeds + monthlyLiabilityService;
  
  // 3. Process Assets
  const investableResult = calculateInvestableCorpus(assets);
  const fireInvestableCorpus = investableResult.includedTotal;
  const investableWeightedReturnRate = calculateInvestableWeightedReturn(
    investableResult.includedAssets,
    user.expectedReturnRate ?? DEFAULT_RETURN_RATE
  );

  let totalAssetValue = 0;
  let liquidBuffer = 0;

  for (const a of assets) {
    if (!a || typeof a !== 'object') continue;
    const val = Number(a.currentValue) || 0;
    totalAssetValue += val;

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

  // 4. Resolve Forecast Data Quality & Availability
  const forecastStatus = {
    available: true,
    missingInputs: [],
    warnings: [],
    dataQuality: 'HIGH'
  };

  // Spending data quality
  const numMonths = monthlySpendingMap.size;
  if (numMonths === 0) {
    forecastStatus.dataQuality = 'INSUFFICIENT';
  } else if (numMonths >= 1 && numMonths <= 2) {
    forecastStatus.dataQuality = 'LOW';
  } else if (numMonths >= 3 && numMonths <= 5) {
    forecastStatus.dataQuality = 'MEDIUM';
  } else if (numMonths >= 6) {
    forecastStatus.dataQuality = 'HIGH';
  }

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
  if (currentAge !== null && currentAge < retirementAge) {
    monthsUntilRetirement = Math.round((retirementAge - currentAge) * 12);
  } else if (currentAge !== null && currentAge >= retirementAge) {
    monthsUntilRetirement = 0;
  }

  // Precedence for contribution: Override -> Observed -> Missing
  let monthlyContributionUsed = null;
  if (options.monthlyContributionOverride !== undefined) {
    monthlyContributionUsed = Number(options.monthlyContributionOverride);
  } else if (monthlySpendingMap.size > 0) {
    monthlyContributionUsed = observedAverageMonthlyInvestment;
  }

  // Required inputs for forecast available
  if (currentAge === null) {
    forecastStatus.available = false;
    forecastStatus.missingInputs.push('MISSING_RETIREMENT_AGE');
  } else if (currentAge >= retirementAge) {
    forecastStatus.available = false;
    forecastStatus.missingInputs.push('RETIREMENT_AGE_REACHED');
  }

  if (forecastStatus.dataQuality === 'INSUFFICIENT') {
    forecastStatus.available = false;
    forecastStatus.missingInputs.push('INSUFFICIENT_SPENDING_HISTORY');
  }

  if (monthlyContributionUsed === null) {
    forecastStatus.available = false;
    forecastStatus.missingInputs.push('MISSING_INVESTMENT_BASELINE');
  }

  // Liability overhang
  const { liabilityOverhang, unknownMaturityCount } = (monthsUntilRetirement !== null) 
    ? calculateLiabilityOverhang(liabilitiesSummary, monthsUntilRetirement) 
    : { liabilityOverhang: 0, unknownMaturityCount: 0 };
    
  if (unknownMaturityCount > 0) {
    forecastStatus.warnings.push('UNKNOWN_LIABILITY_MATURITY_EXCLUDED');
  }

  return {
    user,
    transactions,
    assets,
    liabilities,
    validTxs,
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
    investableWeightedReturnRate,
    currentAge,
    retirementAge,
    monthsUntilRetirement,
    forecastStatus,
    liabilityOverhang
  };
}
