// Value math for fixed-rate deposits (FD / RD). Their value follows from the
// rate, start date and tenure, so the app computes it instead of asking the user.

export const FIXED_DEPOSIT = 'Fixed Deposit';
export const RECURRING_DEPOSIT = 'Recurring Deposit';
export const FIXED_INCOME_TYPES = [FIXED_DEPOSIT, RECURRING_DEPOSIT];

const DAY_MS = 86_400_000;

export const isFixedIncomeType = (assetType) => FIXED_INCOME_TYPES.includes(assetType);

function addMonthsUTC(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

function monthsBetween(start, end) {
  let m = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (addMonthsUTC(start, m) > end) m -= 1;
  return m;
}

// Indian banks compound deposits quarterly.
const grow = (amount, rate, years) => amount * Math.pow(1 + rate / 4, 4 * years);

/**
 * Accrued and maturity value of an FD/RD, or null when its inputs are incomplete
 * (legacy records keep their manually entered currentValue).
 * shortcut: elapsed time uses UTC calendar days, so a value can lag by a day near midnight in the user timezone; fine for valuation.
 */
export function fixedIncomeSnapshot(asset, now = new Date()) {
  if (!asset || !isFixedIncomeType(asset.assetType)) return null;
  const rate = Number(asset.annualReturnRate);
  const tenure = Number(asset.tenureMonths);
  const start = asset.startDate ? new Date(asset.startDate) : null;
  const isRD = asset.assetType === RECURRING_DEPOSIT;
  const amount = Number(isRD ? asset.monthlyContribution : asset.principal);
  if (asset.annualReturnRate == null || !Number.isFinite(rate) || rate < 0 || !Number.isInteger(tenure) || tenure < 1
      || !start || isNaN(start.getTime()) || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const maturityDate = addMonthsUTC(start, tenure);
  const tenureYears = (maturityDate - start) / DAY_MS / 365;
  const at = now < start ? start : now > maturityDate ? maturityDate : now;
  const elapsedYears = (at - start) / DAY_MS / 365;

  let currentValue;
  let maturityValue;
  if (isRD) {
    // Installment k is paid k months after start and compounds until `at` (or maturity).
    const paid = Math.min(tenure, monthsBetween(start, at) + 1);
    const valueAt = (years, count) => {
      let sum = 0;
      for (let k = 0; k < count; k++) sum += grow(amount, rate, Math.max(0, years - k / 12));
      return sum;
    };
    currentValue = now < start ? 0 : valueAt(elapsedYears, paid);
    maturityValue = valueAt(tenureYears, tenure);
  } else {
    currentValue = grow(amount, rate, elapsedYears);
    maturityValue = grow(amount, rate, tenureYears);
  }

  const round = (v) => Math.round(v * 100) / 100;
  return {
    currentValue: round(currentValue),
    maturityValue: round(maturityValue),
    maturityDate,
    matured: now >= maturityDate
  };
}
