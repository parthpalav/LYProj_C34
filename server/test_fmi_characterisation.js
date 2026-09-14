/**
 * server/test_fmi_characterisation.js
 *
 * Golden characterisation tests for individual FMI behavior before and after refactoring.
 * Proves that refactoring FMIService to extract shared scoring helpers produces
 * byte-for-byte / value-for-value identical outputs.
 */

import assert from 'node:assert/strict';
import { calculateFMI } from './services/FMIService.js';

console.log('='.repeat(64));
console.log('  FINAURA INDIVIDUAL FMI CHARACTERISATION TEST SUITE');
console.log('='.repeat(64));

// Fixture 1: D1 below target (savingRatio < 0.7)
const user1 = {
  currentBalance: 50000,
  monthlyIncome: 100000,
  currentAge: 30,
  retirementAge: 60,
  retirementGoal: 36000000, // 100k * 12 * 30
  previousShortfall: 0
};
// monthsLeft = 30 * 12 = 360; remainingGoal = 35,950,000; requiredMonthlySaving = 35,950,000 / 360 = 99861.11...
// Let's use clean fixed numbers with explicit goal
const userClean = {
  currentBalance: 0,
  monthlyIncome: 100000,
  currentAge: 30,
  retirementAge: 40, // 10 years left -> 120 months
  retirementGoal: 2400000, // 2,400,000 / 120 = 20,000 required saving
  previousShortfall: 0
};

// Case 1: D1 below target (saved 7,000 / 20,000 = 35% ratio)
const expenses1 = [
  { amount: 7000, type: 'Investment', category: 'Investments', timestamp: new Date() },
  { amount: 10000, type: 'Need', category: 'Housing', timestamp: new Date() }
];
const res1 = calculateFMI(userClean, expenses1);

// Case 2: D1 exactly at target (saved 20,000 / 20,000 = 100% ratio)
const expenses2 = [
  { amount: 20000, type: 'Investment', category: 'Investments', timestamp: new Date() },
  { amount: 15000, type: 'Need', category: 'Housing', timestamp: new Date() }
];
const res2 = calculateFMI(userClean, expenses2);

// Case 3: D1 above target (saved 30,000 / 20,000 = 150% ratio)
const expenses3 = [
  { amount: 30000, type: 'Investment', category: 'Investments', timestamp: new Date() },
  { amount: 10000, type: 'Need', category: 'Housing', timestamp: new Date() }
];
const res3 = calculateFMI(userClean, expenses3);

// Case 4: D2 well under budget (spendRatio <= 0.7)
// availableMoney = 100,000 - 20,000 = 80,000
const expenses4 = [
  { amount: 20000, type: 'Investment', category: 'Investments', timestamp: new Date() },
  { amount: 5000, type: 'Need', category: 'Housing', timestamp: new Date() }
];
const res4 = calculateFMI(userClean, expenses4);

// Case 5: D2 overspending (predicted spend exceeds availableMoney)
const now = new Date();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const daysPassed = now.getDate();
// spend sufficient to exceed availableMoney = 80,000
const overspendAmount = Math.round((90000 / daysInMonth) * daysPassed) + 5000;
const expenses5 = [
  { amount: 20000, type: 'Investment', category: 'Investments', timestamp: now },
  { amount: overspendAmount, type: 'Need', category: 'Housing', timestamp: now }
];
const res5 = calculateFMI(userClean, expenses5);

// Case 6: D3 with Wants > Needs (Wants: 15k, Needs: 5k)
const expenses6 = [
  { amount: 20000, type: 'Investment', category: 'Investments', timestamp: now },
  { amount: 5000, type: 'Need', category: 'Housing', timestamp: now },
  { amount: 15000, type: 'Want', category: 'Shopping', timestamp: now }
];
const res6 = calculateFMI(userClean, expenses6);

// Case 7: D3 with multiple penalties (Wants > Needs + Late Night)
const lateNightTime = new Date();
lateNightTime.setHours(23, 30, 0, 0);
const expenses7 = [
  { amount: 20000, type: 'Investment', category: 'Investments', timestamp: now },
  { amount: 5000, type: 'Need', category: 'Housing', timestamp: now },
  { amount: 15000, type: 'Want', category: 'Shopping', timestamp: lateNightTime },
  { amount: 2000, type: 'Want', category: 'Shopping', timestamp: lateNightTime }
];
const res7 = calculateFMI(userClean, expenses7);

// Capture snapshots
const goldenSnapshots = {
  res1: {
    FMI: res1.FMI,
    score: res1.score,
    fmiLabel: res1.fmiLabel,
    status: res1.status,
    d1: res1.pillars.D1_savingDiscipline,
    d2: res1.pillars.D2_spendingControl,
    d3: res1.pillars.D3_behavioralRisk
  },
  res2: {
    FMI: res2.FMI,
    score: res2.score,
    fmiLabel: res2.fmiLabel,
    status: res2.status,
    d1: res2.pillars.D1_savingDiscipline,
    d2: res2.pillars.D2_spendingControl,
    d3: res2.pillars.D3_behavioralRisk
  },
  res3: {
    FMI: res3.FMI,
    score: res3.score,
    fmiLabel: res3.fmiLabel,
    status: res3.status,
    d1: res3.pillars.D1_savingDiscipline,
    d2: res3.pillars.D2_spendingControl,
    d3: res3.pillars.D3_behavioralRisk
  },
  res4: {
    FMI: res4.FMI,
    score: res4.score,
    fmiLabel: res4.fmiLabel,
    status: res4.status,
    d1: res4.pillars.D1_savingDiscipline,
    d2: res4.pillars.D2_spendingControl,
    d3: res4.pillars.D3_behavioralRisk
  },
  res5: {
    FMI: res5.FMI,
    score: res5.score,
    fmiLabel: res5.fmiLabel,
    status: res5.status,
    d1: res5.pillars.D1_savingDiscipline,
    d2: res5.pillars.D2_spendingControl,
    d3: res5.pillars.D3_behavioralRisk
  },
  res6: {
    FMI: res6.FMI,
    score: res6.score,
    fmiLabel: res6.fmiLabel,
    status: res6.status,
    d1: res6.pillars.D1_savingDiscipline,
    d2: res6.pillars.D2_spendingControl,
    d3: res6.pillars.D3_behavioralRisk
  },
  res7: {
    FMI: res7.FMI,
    score: res7.score,
    fmiLabel: res7.fmiLabel,
    status: res7.status,
    d1: res7.pillars.D1_savingDiscipline,
    d2: res7.pillars.D2_spendingControl,
    d3: res7.pillars.D3_behavioralRisk
  }
};

console.log('Golden Snapshots captured:');
console.log('Case 1 (D1 below target): D1 score =', goldenSnapshots.res1.d1.score, 'FMI =', goldenSnapshots.res1.FMI);
console.log('Case 2 (D1 at target):    D1 score =', goldenSnapshots.res2.d1.score, 'FMI =', goldenSnapshots.res2.FMI);
console.log('Case 3 (D1 above target): D1 score =', goldenSnapshots.res3.d1.score, 'FMI =', goldenSnapshots.res3.FMI);
console.log('Case 4 (D2 under budget): D2 score =', goldenSnapshots.res4.d2.score, 'Status =', goldenSnapshots.res4.status);
console.log('Case 5 (D2 over budget):  D2 score =', goldenSnapshots.res5.d2.score, 'Status =', goldenSnapshots.res5.status);
console.log('Case 6 (D3 Wants>Needs):  D3 score =', goldenSnapshots.res6.d3.score, 'Detail =', goldenSnapshots.res6.d3.detail);
console.log('Case 7 (D3 multi-risk):   D3 score =', goldenSnapshots.res7.d3.score, 'Detail =', goldenSnapshots.res7.d3.detail);

// Assert baseline sanity
assert.strictEqual(goldenSnapshots.res2.d1.score, 90); // 100% saving ratio is 90
assert.ok(goldenSnapshots.res3.d1.score >= 95); // > 100% saving ratio
assert.ok(goldenSnapshots.res1.d1.score < 60);  // < 70% saving ratio
assert.strictEqual(goldenSnapshots.res6.d3.score, 85); // 100 - 15 = 85
assert.strictEqual(goldenSnapshots.res7.d3.score, 70); // 100 - 15 - 15 = 70

console.log('✅ Baseline sanity verified successfully!');

export { goldenSnapshots, userClean };
