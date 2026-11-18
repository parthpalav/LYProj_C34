/**
 * Forecast inputs: history stops at the reference date (in the user's timezone).
 * Pure functions, no database. Run: node server/tests/predictability/forecastInputs.test.js
 */
import assert from 'node:assert/strict';
import { resolveForecastInputs } from '../../utils/forecastResolver.js';
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

console.log('\nforecastInputs: all checks passed');
