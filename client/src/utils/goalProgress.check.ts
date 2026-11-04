// Self-check: node --experimental-strip-types src/utils/goalProgress.check.ts
import assert from 'node:assert/strict';
import { goalPlan, goalProgress, milestoneCrossed } from './goalProgress.ts';

assert.deepEqual(goalProgress(2500, 2500, 10000), { from: 0.25, to: 0.5, newSaved: 5000, completed: false });
assert.equal(goalProgress(9000, 1000, 10000).completed, true);
assert.equal(goalProgress(9000, 5000, 10000).to, 1); // overshoot clamps
assert.equal(goalProgress(12000, 100, 10000).completed, false); // already done before
assert.deepEqual(goalProgress(0, 500, 0), { from: 0, to: 0, newSaved: 500, completed: false }); // no target

assert.equal(milestoneCrossed(0.2, 0.3), 0.25);
assert.equal(milestoneCrossed(0.2, 0.8), 0.75); // a big jump reports the highest milestone
assert.equal(milestoneCrossed(0.3, 0.4), null);
assert.equal(milestoneCrossed(0.9, 1), null); // finishing is `completed`, not a milestone

const now = new Date(2026, 9, 29);
assert.deepEqual(goalPlan(10000, 70000, '2027-04-01', 12000, now), { months: 6, remaining: 60000, requiredMonthly: 10000, gap: 2000 });
assert.equal(goalPlan(0, 1000, 'someday', 0, now).months, null); // unreadable date
assert.equal(goalPlan(0, 1000, '2026-10-30', 0, now).months, 1); // never divides by zero
assert.equal(goalPlan(0, 12000, 'December 2027', 500, now).months, 14); // free-text month names parse
assert.equal(goalPlan(0, 12000, 'Sept 2027', 500, now).months, 11);
console.log('goalProgress ok');
