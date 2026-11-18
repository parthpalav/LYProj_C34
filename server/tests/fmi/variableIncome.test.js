import assert from 'node:assert/strict';
import { resolveMonthlyIncome } from '../../services/FMIService.js';

const declared = { monthlyIncome: 40000 };

// Salaried and student accounts keep the declared figure
assert.equal(resolveMonthlyIncome({ ...declared, incomeType: 'salaried' }, 5000, true), 40000);
assert.equal(resolveMonthlyIncome({ ...declared, incomeType: 'student' }, 5000, true), 40000);

// Freelance/gig score against what actually arrived, including nothing
assert.equal(resolveMonthlyIncome({ ...declared, incomeType: 'freelancer' }, 12500, true), 12500);
assert.equal(resolveMonthlyIncome({ ...declared, incomeType: 'gig' }, 0, true), 0);

// A freelancer who has never logged income falls back to the declared figure
assert.equal(resolveMonthlyIncome({ ...declared, incomeType: 'freelancer' }, 0, false), 40000);

console.log('variableIncome: all assertions passed');
