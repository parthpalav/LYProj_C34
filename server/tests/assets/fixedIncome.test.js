// Pure checks for FD/RD valuation. Run: node server/tests/assets/fixedIncome.test.js
import assert from 'node:assert/strict';
import { fixedIncomeSnapshot } from '../../utils/fixedIncome.js';

const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// FD: 1,00,000 at 7% for 12 months, quarterly compounding -> 1,07,186.
const fd = { assetType: 'Fixed Deposit', principal: 100000, annualReturnRate: 0.07, tenureMonths: 12, startDate: '2026-01-01T00:00:00Z' };
const fdMat = fixedIncomeSnapshot(fd, new Date('2027-06-01T00:00:00Z'));
close(fdMat.maturityValue, 107186);
assert.equal(fdMat.currentValue, fdMat.maturityValue, 'value stops growing after maturity');
assert.equal(fdMat.matured, true);
assert.equal(fdMat.maturityDate.toISOString(), '2027-01-01T00:00:00.000Z');
const fdMid = fixedIncomeSnapshot(fd, new Date('2026-07-02T00:00:00Z'));
assert.ok(fdMid.currentValue > 100000 && fdMid.currentValue < fdMat.maturityValue);
assert.equal(fdMid.matured, false);

// RD: 5,000/month at 7% for 12 months. Standard formula sum(I * (1 + r/4)^(4i/12), i = 1..12) = 62,309.
const rd = { assetType: 'Recurring Deposit', monthlyContribution: 5000, annualReturnRate: 0.07, tenureMonths: 12, startDate: '2026-01-01T00:00:00Z' };
const rdMat = fixedIncomeSnapshot(rd, new Date('2028-01-01T00:00:00Z'));
close(rdMat.maturityValue, 62309, 5);
// After 3 installments (1 Jan, 1 Feb, 1 Mar), value is just over 15,000.
const rdMid = fixedIncomeSnapshot(rd, new Date('2026-03-15T00:00:00Z'));
assert.ok(rdMid.currentValue > 15000 && rdMid.currentValue < 15200, String(rdMid.currentValue));

// Incomplete or non-deposit assets are not valued.
assert.equal(fixedIncomeSnapshot({ ...fd, tenureMonths: null }), null);
assert.equal(fixedIncomeSnapshot({ ...fd, principal: 0 }), null);
assert.equal(fixedIncomeSnapshot({ ...fd, annualReturnRate: null }), null); // missing rate must not count as 0%
assert.equal(fixedIncomeSnapshot({ ...rd, monthlyContribution: null }), null);
assert.equal(fixedIncomeSnapshot({ ...fd, assetType: 'Mutual Fund' }), null);

// Month-end start: 31 Jan + 1 month matures 28 Feb.
const feb = fixedIncomeSnapshot({ ...fd, tenureMonths: 1, startDate: '2027-01-31T00:00:00Z' }, new Date('2027-03-10T00:00:00Z'));
assert.equal(feb.maturityDate.toISOString(), '2027-02-28T00:00:00.000Z');

console.log('fixedIncome checks passed');
