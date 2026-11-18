/**
 * Forecast inputs: history stops at the reference date (in the user's timezone),
 * and interest-free loans have a real term instead of "unknown".
 * Pure functions, no database. Run: node server/tests/predictability/forecastInputs.test.js
 */
import assert from 'node:assert/strict';
import {
  resolveForecastInputs,
  deriveLiabilityRemainingTerm,
  calculateLiabilityOverhang
} from '../../utils/forecastResolver.js';
import { amortizeLiability } from '../../utils/financialMath.js';
import { zoneForecastInput } from '../../services/userTimezone.js';

const user = { age: 30, retirementAge: 60, timezone: 'Asia/Kolkata' };
const need = (amount, timestamp) => ({ amount, type: 'Need', category: 'Groceries', timestamp });
const resolve = (transactions, referenceDate) =>
  resolveForecastInputs(...zoneForecastInput({ user, transactions, assets: [], liabilities: [] }, { referenceDate }));

// 1. Mixed dates: a ₹1,000 November expense counts, a ₹9,000 January one has not happened.
let r = resolve([need(1000, '2026-11-10T06:00:00Z'), need(9000, '2027-01-10T06:00:00Z')], '2026-11-18T06:00:00Z');
assert.equal(r.averageMonthlyNeeds, 1000, 'future expense must not change historical needs');
assert.equal(r.activeMonthsCount, 1);
console.log('  ✅ mixed dates: only entries up to the reference date count');

// 2. Future-only data is no history at all (no fallback to the future).
r = resolve([need(9000, '2027-01-10T06:00:00Z')], '2026-11-18T06:00:00Z');
assert.equal(r.averageMonthlyNeeds, 0);
assert.equal(r.forecastStatus.available, false);
assert.ok(r.forecastStatus.missingInputs.includes('INSUFFICIENT_SPENDING_HISTORY'));
console.log('  ✅ future-only data is treated as no spending history');

// 3. Kolkata month boundary: reference is 1 Dec 00:30 IST (30 Nov 19:00 UTC).
r = resolve([
  need(3000, '2026-11-10T06:00:00Z'),   // November
  need(1000, '2026-11-30T18:45:00Z'),   // 1 Dec 00:15 IST: December, already happened
  need(5000, '2026-11-30T19:30:00Z'),   // 1 Dec 01:00 IST: after the reference
], '2026-11-30T19:00:00Z');
assert.equal(r.activeMonthsCount, 2, 'November and December in the user timezone');
assert.equal(r.averageMonthlyNeeds, 2000, '(3000 + 1000) / 2');
console.log('  ✅ user-timezone month boundary respects the reference time');

// 4. Interest-free loan: ₹12,000 at ₹1,000/month is 12 months; a missing rate stays unknown.
assert.equal(deriveLiabilityRemainingTerm(12000, 0, 1000), 12);
assert.equal(deriveLiabilityRemainingTerm(12000, null, 1000), null, 'missing rate is unknown, not zero');
assert.equal(deriveLiabilityRemainingTerm(12000, undefined, 1000), null);
assert.equal(deriveLiabilityRemainingTerm(12000, '', 1000), null);
assert.equal(deriveLiabilityRemainingTerm(120000, 0.12, 2000) > 0, true, 'interest-bearing loans unchanged');
console.log('  ✅ zero-interest loan term is 12 months; missing rate stays unknown');

// 5. At month six: six payments made and ₹6,000 left, both in amortization and in overhang.
const amort = amortizeLiability({ outstandingPrincipal: 12000, annualInterestRate: 0, monthlyPayment: 1000 });
assert.equal(amort.monthsUsed, 12);
assert.equal(amort.schedule.slice(0, 6).length, 6);
assert.equal(amort.schedule[5].closingPrincipal, 6000);
const zeroLoan = { outstandingBalance: 12000, interestRate: 0, monthlyAmount: 1000, remainingTermMonths: null };
let o = calculateLiabilityOverhang([zeroLoan], 6);
assert.equal(o.liabilityOverhang, 6000, 'loan continuing past retirement in 6 months leaves ₹6,000');
assert.equal(o.unknownMaturityCount, 0);
o = calculateLiabilityOverhang([{ ...zeroLoan, interestRate: null }], 6);
assert.equal(o.unknownMaturityCount, 1, 'missing rate is still reported as unknown');
o = calculateLiabilityOverhang([zeroLoan], 12);
assert.equal(o.liabilityOverhang, 0, 'paid off by retirement');
console.log('  ✅ interest-free loan: six payments, ₹6,000 remaining at month six');

console.log('\nforecastInputs: all checks passed');
