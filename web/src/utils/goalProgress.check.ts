import assert from 'node:assert/strict';
import { goalProgress, milestoneCrossed } from './goalProgress.ts';

assert.deepEqual(goalProgress(2500, 2500, 10000), { from: 0.25, to: 0.5, newSaved: 5000, completed: false });
assert.equal(goalProgress(9000, 1000, 10000).completed, true);
assert.equal(goalProgress(9000, 5000, 10000).to, 1); // overshoot clamps
assert.equal(goalProgress(12000, 100, 10000).completed, false); // already done before
assert.deepEqual(goalProgress(0, 500, 0), { from: 0, to: 0, newSaved: 500, completed: false }); // no target

assert.equal(milestoneCrossed(0.2, 0.3), 0.25);
assert.equal(milestoneCrossed(0.2, 0.8), 0.75); // a big jump reports the highest milestone
assert.equal(milestoneCrossed(0.3, 0.4), null);
assert.equal(milestoneCrossed(0.9, 1), null); // finishing is `completed`, not a milestone

console.log('goalProgress ok');
