/**
 * server/utils/incomeAnalytics.js
 * 
 * Pure deterministic irregular-income intelligence module for FINAURA.
 * No database access, no HTTP calls, no external side-effects.
 * 
 * Core Philosophy:
 *  - Income variability is a financial characteristic to plan around, not a financial-health penalty.
 *  - Income Uncertainty (CV, gaps, zero-months) is measured separately from Financial Resilience (coverage, runway).
 *  - No composite "wellness score" or "health penalty" is outputted by this layer.
 */

export const DATA_QUALITY_LEVEL = Object.freeze({
  INSUFFICIENT: 'INSUFFICIENT',
  VERY_LOW:     'VERY_LOW',
  LOW:          'LOW',
  MODERATE:     'MODERATE',
  HIGH:         'HIGH'
});

/**
 * Normalizes and filters raw income events.
 * Excludes invalid dates and non-positive/non-finite amounts.
 * Returns sorted chronologically. Does NOT mutate input array.
 * 
 * @param {Array<Object>} events - Array of raw income objects
 * @returns {Array<Object>} Normalized, sorted income events
 */
export function normalizeIncomeEvents(events = []) {
  if (!Array.isArray(events)) {
    throw new TypeError('events must be an array');
  }

  const validEvents = [];

  for (const item of events) {
    if (!item || typeof item !== 'object') continue;

    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const rawDate = item.timestamp || item.date;
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) continue;

    validEvents.push({
      id: item.id || item._id?.toString() || undefined,
      amount,
      date,
      source: item.source || 'other',
      description: item.description || ''
    });
  }

  return validEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Groups income events into consecutive calendar months (YYYY-MM).
 * Fills in missing calendar months in the range with ₹0 to avoid understating irregularity.
 * 
 * @param {Array<Object>} events - Income events
 * @param {Object} [options={}]
 * @param {Date|string} [options.startDate] - Optional range start
 * @param {Date|string} [options.endDate] - Optional range end
 * @returns {Array<Object>} Array of monthly totals ordered chronologically
 */
export function aggregateMonthlyIncome(events = [], options = {}) {
  const normalized = normalizeIncomeEvents(events);

  if (normalized.length === 0 && !options.startDate && !options.endDate) {
    return [];
  }

  let start = options.startDate ? new Date(options.startDate) : (normalized.length > 0 ? normalized[0].date : new Date());
  let end = options.endDate ? new Date(options.endDate) : (normalized.length > 0 ? normalized[normalized.length - 1].date : new Date());

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new TypeError('Invalid startDate or endDate provided');
  }

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  // Create monthly map
  const monthlyMap = new Map();
  let curr = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endLimit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (curr <= endLimit) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const key = `${y}-${m}`;
    monthlyMap.set(key, {
      yearMonth: key,
      year: y,
      month: curr.getUTCMonth() + 1,
      amount: 0,
      eventCount: 0
    });
    curr.setUTCMonth(curr.getUTCMonth() + 1);
  }

  // Aggregate normalized events into months
  for (const e of normalized) {
    const y = e.date.getUTCFullYear();
    const m = String(e.date.getUTCMonth() + 1).padStart(2, '0');
    const key = `${y}-${m}`;
    if (monthlyMap.has(key)) {
      const entry = monthlyMap.get(key);
      entry.amount += e.amount;
      entry.eventCount += 1;
    }
  }

  return Array.from(monthlyMap.values());
}

/**
 * Calculates mean monthly income.
 * 
 * @param {Array<number|Object>} monthlyData - Array of amounts or monthly objects
 * @returns {number} Mean monthly income
 */
export function calculateMeanMonthlyIncome(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) return 0;

  const amounts = monthlyData.map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d)));
  const sum = amounts.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
  return sum / amounts.length;
}

/**
 * Calculates true median monthly income.
 * Robust against high or low income spikes.
 * 
 * @param {Array<number|Object>} monthlyData - Array of amounts or monthly objects
 * @returns {number} Median monthly income
 */
export function calculateMedianMonthlyIncome(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) return 0;

  const amounts = monthlyData
    .map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (amounts.length === 0) return 0;

  const mid = Math.floor(amounts.length / 2);
  if (amounts.length % 2 !== 0) {
    return amounts[mid];
  }
  return (amounts[mid - 1] + amounts[mid]) / 2;
}

/**
 * Calculates Population Standard Deviation of monthly income.
 * Convention: Population std dev (N in denominator) since observed window represents full user record.
 * 
 * @param {Array<number|Object>} monthlyData - Array of amounts or monthly objects
 * @returns {number} Population standard deviation
 */
export function calculateStdDevMonthlyIncome(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length <= 1) return 0;

  const amounts = monthlyData
    .map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d)))
    .filter(Number.isFinite);

  if (amounts.length <= 1) return 0;

  const mean = calculateMeanMonthlyIncome(amounts);
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  return Math.sqrt(variance);
}

/**
 * Calculates Coefficient of Variation (CV) of monthly income:
 * CV = standardDeviation / mean
 * 
 * Descriptive variability measure; never used as a penalty.
 * 
 * @param {Array<number|Object>} monthlyData - Array of amounts or monthly objects
 * @returns {number|null} Coefficient of variation (or null if mean is 0)
 */
export function calculateCVMonthlyIncome(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) return null;

  const mean = calculateMeanMonthlyIncome(monthlyData);
  if (mean === 0) return null;

  const stdDev = calculateStdDevMonthlyIncome(monthlyData);
  return stdDev / mean;
}

/**
 * Calculates empirical percentile using linear interpolation (standard R-7 / NIST method).
 * 
 * @param {Array<number>} values - Array of numeric values
 * @param {number} p - Percentile as decimal between 0 and 1 (e.g. 0.25 for 25th percentile)
 * @returns {number} Interpolated percentile value
 */
export function calculatePercentile(values = [], p = 0.25) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  if (p < 0 || p > 1) {
    throw new RangeError('percentile p must be between 0 and 1');
  }

  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
}

/**
 * Calculates reliable / conservative monthly income based on lower quartile (25th percentile).
 * Acts as a lower planning reference, not a guarantee.
 * 
 * @param {Array<number|Object>} monthlyData - Monthly income array
 * @param {number} [percentile=0.25] - Target percentile fraction (default 0.25)
 * @returns {Object} { reliableMonthlyIncome, percentile, method }
 */
export function calculateReliableMonthlyIncome(monthlyData = [], percentile = 0.25) {
  const amounts = Array.isArray(monthlyData)
    ? monthlyData.map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d))).filter(Number.isFinite)
    : [];

  const val = calculatePercentile(amounts, percentile);

  return {
    reliableMonthlyIncome: val,
    percentile,
    method: 'linear_interpolation'
  };
}

/**
 * Calculates the worst rolling quarter (minimum consecutive 3-month average income).
 * Useful for deterministic downside planning.
 * 
 * @param {Array<number|Object>} monthlyData - Monthly income array in chronological order
 * @returns {Object} { available, amount, startMonth, endMonth }
 */
export function calculateWorstRollingQuarter(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length < 3) {
    return {
      available: false,
      amount: null,
      startMonth: null,
      endMonth: null,
      reason: 'INSUFFICIENT_DATA'
    };
  }

  const items = monthlyData.map(d => {
    if (typeof d === 'object' && d !== null) {
      return { amount: Number(d.amount) || 0, yearMonth: d.yearMonth || null };
    }
    return { amount: Number(d) || 0, yearMonth: null };
  });

  let minAvg = Infinity;
  let bestIdx = 0;

  for (let i = 0; i <= items.length - 3; i++) {
    const avg = (items[i].amount + items[i + 1].amount + items[i + 2].amount) / 3;
    if (avg < minAvg) {
      minAvg = avg;
      bestIdx = i;
    }
  }

  return {
    available: true,
    amount: minAvg,
    startMonth: items[bestIdx].yearMonth,
    endMonth: items[bestIdx + 2].yearMonth
  };
}

/**
 * Analyzes payment timing gaps between individual income events.
 * 
 * @param {Array<Object>} events - Raw or normalized income events
 * @returns {Object} Gap statistics in days
 */
export function calculateIncomeGaps(events = []) {
  const normalized = normalizeIncomeEvents(events);
  const n = normalized.length;

  if (n === 0) {
    return {
      numberOfIncomeEvents: 0,
      averageGapDays: null,
      medianGapDays: null,
      longestGapDays: null,
      gapStdDevDays: null
    };
  }

  if (n === 1) {
    return {
      numberOfIncomeEvents: 1,
      averageGapDays: null,
      medianGapDays: null,
      longestGapDays: 0,
      gapStdDevDays: 0
    };
  }

  const gaps = [];
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  for (let i = 0; i < n - 1; i++) {
    const diffDays = (normalized[i + 1].date.getTime() - normalized[i].date.getTime()) / MS_PER_DAY;
    gaps.push(diffDays);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sortedGaps.length / 2);
  const medianGap = sortedGaps.length % 2 !== 0
    ? sortedGaps[mid]
    : (sortedGaps[mid - 1] + sortedGaps[mid]) / 2;
  const maxGap = Math.max(...gaps);

  const variance = gaps.reduce((acc, g) => acc + Math.pow(g - avgGap, 2), 0) / gaps.length;
  const stdDevGap = Math.sqrt(variance);

  return {
    numberOfIncomeEvents: n,
    averageGapDays: avgGap,
    medianGapDays: medianGap,
    longestGapDays: maxGap,
    gapStdDevDays: stdDevGap
  };
}

/**
 * Analyzes zero-income months and longest dry spell runs.
 * 
 * @param {Array<number|Object>} monthlyData - Chronological monthly income array
 * @returns {Object} Zero-income statistics
 */
export function analyzeZeroIncomeMonths(monthlyData = []) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    return {
      totalMonths: 0,
      numberOfZeroIncomeMonths: 0,
      zeroIncomeMonthRatio: 0,
      longestConsecutiveZeroIncomeMonths: 0
    };
  }

  const amounts = monthlyData.map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d)));
  const total = amounts.length;
  let zeroCount = 0;
  let maxRun = 0;
  let currentRun = 0;

  for (const amt of amounts) {
    if (amt === 0) {
      zeroCount++;
      currentRun++;
      if (currentRun > maxRun) maxRun = currentRun;
    } else {
      currentRun = 0;
    }
  }

  return {
    totalMonths: total,
    numberOfZeroIncomeMonths: zeroCount,
    zeroIncomeMonthRatio: total > 0 ? zeroCount / total : 0,
    longestConsecutiveZeroIncomeMonths: maxRun
  };
}

/**
 * Compares current month income against a separately supplied historical baseline.
 * 
 * @param {Object} params
 * @param {number} params.currentMonthIncome - Latest monthly income amount
 * @param {Array<number|Object>} params.baselineMonthlyIncomes - Historical monthly amounts (excluding current)
 * @returns {Object} Personal baseline deviation metrics
 */
export function calculateBaselineDeviation({ currentMonthIncome, baselineMonthlyIncomes = [] }) {
  if (typeof currentMonthIncome !== 'number' || !Number.isFinite(currentMonthIncome)) {
    throw new TypeError('currentMonthIncome must be a finite number');
  }

  const amounts = Array.isArray(baselineMonthlyIncomes)
    ? baselineMonthlyIncomes.map(d => (typeof d === 'object' && d !== null ? d.amount : Number(d))).filter(Number.isFinite)
    : [];

  if (amounts.length === 0) {
    return {
      sufficientBaseline: false,
      zScore: null,
      currentVsMedianRatio: null,
      currentVsMeanRatio: null,
      historicalMedian: null,
      historicalMean: null
    };
  }

  const mean = calculateMeanMonthlyIncome(amounts);
  const median = calculateMedianMonthlyIncome(amounts);
  const stdDev = calculateStdDevMonthlyIncome(amounts);

  let zScore = null;
  if (stdDev > 0) {
    zScore = (currentMonthIncome - mean) / stdDev;
  } else if (currentMonthIncome === mean) {
    zScore = 0;
  }

  const currentVsMedianRatio = median > 0 ? currentMonthIncome / median : null;
  const currentVsMeanRatio = mean > 0 ? currentMonthIncome / mean : null;

  return {
    sufficientBaseline: amounts.length >= 3,
    zScore,
    currentVsMedianRatio,
    currentVsMeanRatio,
    historicalMedian: median,
    historicalMean: mean
  };
}

/**
 * Evaluates essential obligations coverage ratio:
 * essentialCoverageRatio = reliableMonthlyIncome / essentialMonthlySpend
 * 
 * @param {Object} params
 * @param {number} params.reliableMonthlyIncome - Conservative 25th percentile income
 * @param {number} params.essentialMonthlySpend - Needs + Debt obligations
 * @returns {Object} Coverage metrics
 */
export function calculateEssentialCoverage({ reliableMonthlyIncome, essentialMonthlySpend }) {
  if (typeof reliableMonthlyIncome !== 'number' || !Number.isFinite(reliableMonthlyIncome)) {
    throw new TypeError('reliableMonthlyIncome must be a finite number');
  }
  if (typeof essentialMonthlySpend !== 'number' || !Number.isFinite(essentialMonthlySpend)) {
    throw new TypeError('essentialMonthlySpend must be a finite number');
  }

  if (essentialMonthlySpend === 0) {
    return {
      essentialCoverageRatio: null,
      isCoverageAdequate: null,
      noEssentialSpend: true
    };
  }

  const ratio = reliableMonthlyIncome / essentialMonthlySpend;

  return {
    essentialCoverageRatio: ratio,
    isCoverageAdequate: ratio >= 1.0,
    noEssentialSpend: false
  };
}

/**
 * Evaluates liquid buffer runway in months:
 * bufferRunwayMonths = liquidBuffer / essentialMonthlySpend
 * 
 * @param {Object} params
 * @param {number} params.liquidBuffer - Explicitly supplied liquid buffer assets
 * @param {number} params.essentialMonthlySpend - Essential monthly spending
 * @returns {Object} Runway metrics
 */
export function calculateBufferRunway({ liquidBuffer, essentialMonthlySpend }) {
  if (typeof liquidBuffer !== 'number' || !Number.isFinite(liquidBuffer)) {
    throw new TypeError('liquidBuffer must be a finite number');
  }
  if (typeof essentialMonthlySpend !== 'number' || !Number.isFinite(essentialMonthlySpend)) {
    throw new TypeError('essentialMonthlySpend must be a finite number');
  }

  if (essentialMonthlySpend === 0) {
    return {
      bufferRunwayMonths: null,
      noEssentialSpend: true
    };
  }

  return {
    bufferRunwayMonths: liquidBuffer / essentialMonthlySpend,
    noEssentialSpend: false
  };
}

/**
 * Evaluates dataset quality based on observation length.
 * 
 * @param {number} monthsCount - Number of observed monthly bins
 * @returns {Object} { dataQualityLevel, monthsObserved, limitations }
 */
export function evaluateDataQuality(monthsCount = 0) {
  const count = Math.max(0, Math.floor(monthsCount));

  if (count === 0) {
    return {
      dataQualityLevel: DATA_QUALITY_LEVEL.INSUFFICIENT,
      monthsObserved: 0,
      limitations: ['No income history available for analysis']
    };
  }

  if (count <= 2) {
    return {
      dataQualityLevel: DATA_QUALITY_LEVEL.VERY_LOW,
      monthsObserved: count,
      limitations: ['History under 3 months; volatility and rolling quarter estimates are unstable']
    };
  }

  if (count <= 5) {
    return {
      dataQualityLevel: DATA_QUALITY_LEVEL.LOW,
      monthsObserved: count,
      limitations: ['Limited history (under 6 months); seasonal patterns are not captured']
    };
  }

  if (count <= 11) {
    return {
      dataQualityLevel: DATA_QUALITY_LEVEL.MODERATE,
      monthsObserved: count,
      limitations: ['Moderate history (under 12 months); annual seasonality only partially observed']
    };
  }

  return {
    dataQualityLevel: DATA_QUALITY_LEVEL.HIGH,
    monthsObserved: count,
    limitations: []
  };
}

/**
 * Pure master orchestrator: analyzes income history, variability, payment timing,
 * downside risk, and resilience.
 * 
 * @param {Object} params
 * @param {Array<Object>} params.incomeEvents - Raw or normalized income events
 * @param {Date|string} [params.startDate] - Start of analysis window
 * @param {Date|string} [params.endDate] - End of analysis window
 * @param {number} [params.essentialMonthlySpend=0] - Explicitly provided essential expenditures
 * @param {number} [params.liquidBuffer=0] - Explicitly provided liquid buffer reserves
 * @param {number} [params.currentMonthIncome=null] - Optional current month observation for baseline check
 * @returns {Object} Comprehensive income resilience snapshot
 */
export function analyzeIncomeResilience({
  incomeEvents = [],
  startDate,
  endDate,
  essentialMonthlySpend = 0,
  liquidBuffer = 0,
  currentMonthIncome = null
}) {
  const monthlyTimeline = aggregateMonthlyIncome(incomeEvents, { startDate, endDate });
  const monthsCount = monthlyTimeline.length;

  const dataQuality = evaluateDataQuality(monthsCount);
  const meanMonthly = calculateMeanMonthlyIncome(monthlyTimeline);
  const medianMonthly = calculateMedianMonthlyIncome(monthlyTimeline);
  const stdDevMonthly = calculateStdDevMonthlyIncome(monthlyTimeline);
  const cv = calculateCVMonthlyIncome(monthlyTimeline);
  const reliable = calculateReliableMonthlyIncome(monthlyTimeline, 0.25);
  const worstQuarter = calculateWorstRollingQuarter(monthlyTimeline);
  const zeroMonthStats = analyzeZeroIncomeMonths(monthlyTimeline);
  const gapStats = calculateIncomeGaps(incomeEvents);

  const coverage = calculateEssentialCoverage({
    reliableMonthlyIncome: reliable.reliableMonthlyIncome,
    essentialMonthlySpend
  });

  const runway = calculateBufferRunway({
    liquidBuffer,
    essentialMonthlySpend
  });

  let baselineComparison = null;
  if (currentMonthIncome !== null && typeof currentMonthIncome === 'number') {
    baselineComparison = calculateBaselineDeviation({
      currentMonthIncome,
      baselineMonthlyIncomes: monthlyTimeline
    });
  }

  return {
    dataQuality,
    monthlyTimeline,
    centralIncome: {
      meanMonthlyIncome: meanMonthly,
      medianMonthlyIncome: medianMonthly,
      reliableMonthlyIncome: reliable.reliableMonthlyIncome,
      percentileUsed: reliable.percentile
    },
    variability: {
      standardDeviation: stdDevMonthly,
      coefficientOfVariation: cv,
      zeroIncomeMonthsCount: zeroMonthStats.numberOfZeroIncomeMonths,
      zeroIncomeMonthRatio: zeroMonthStats.zeroIncomeMonthRatio,
      longestConsecutiveZeroIncomeMonths: zeroMonthStats.longestConsecutiveZeroIncomeMonths
    },
    timing: gapStats,
    downside: worstQuarter,
    resilience: {
      essentialMonthlySpend,
      liquidBuffer,
      essentialCoverageRatio: coverage.essentialCoverageRatio,
      isCoverageAdequate: coverage.isCoverageAdequate,
      bufferRunwayMonths: runway.bufferRunwayMonths
    },
    baselineComparison
  };
}
