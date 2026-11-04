// Self-check: node --experimental-strip-types src/utils/assumptions.check.ts
import assert from 'node:assert/strict';
import { readAssumptions } from './assumptions.ts';

const base = { name: 'Asha', income: '', retAge: '', corpus: '', ret: '', inf: '', swr: '', life: '', ef: '' };

const ok = readAssumptions(base);
assert.ok('payload' in ok);
assert.equal(ok.payload.expectedReturnRate, 0.08); // blanks fall back to policy defaults
assert.equal(ok.payload.emergencyFundTargetMonths, 6);
assert.equal(ok.payload.retirementAge, undefined);

assert.deepEqual(readAssumptions({ ...base, name: ' ' }), { error: 'Name cannot be blank.' });
assert.ok('error' in readAssumptions({ ...base, retAge: '39' }));
assert.ok('error' in readAssumptions({ ...base, retAge: '60.5' }));
assert.ok('error' in readAssumptions({ ...base, swr: '0' }));
assert.ok('error' in readAssumptions({ ...base, ef: '37' }));
assert.ok('error' in readAssumptions({ ...base, income: 'abc' }));

const full = readAssumptions({ ...base, retAge: '55', income: '90000', ret: '10', life: '120', ef: '12' });
assert.ok('payload' in full);
assert.equal(full.payload.retirementAge, 55);
assert.equal(full.payload.expectedReturnRate, 0.1);
assert.equal(full.payload.lifestyleAdjustmentRatio, 1.2);

console.log('assumptions: ok');
