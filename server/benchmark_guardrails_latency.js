import { performance } from 'node:perf_hooks';
import { buildPredictabilitySnapshotAsync } from './services/PredictabilityService.js';

function createTransactions(monthsCount, needsPerMonth, wantsPerMonth, investPerMonth, refDateStr = '2026-06-15') {
  const refDate = new Date(refDateStr);
  const txs = [];
  for (let m = 1; m <= monthsCount; m++) {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - m, 10));
    if (needsPerMonth > 0) {
      txs.push({ amount: needsPerMonth, type: 'Need', timestamp: d, category: 'Bills', description: 'Essential Living' });
    }
    if (wantsPerMonth > 0) {
      txs.push({ amount: wantsPerMonth, type: 'Want', timestamp: d, category: 'Shopping', description: 'Discretionary' });
    }
    if (investPerMonth > 0) {
      txs.push({ amount: investPerMonth, type: 'Investment', timestamp: d, category: 'Misc', description: 'Mutual Fund SIP' });
    }
  }
  return txs;
}

const underfundedUser = {
  id: 'p08',
  age: 55,
  retirementAge: 60,
  monthlyIncome: 100000,
  currentBalance: 50000
};
const underfundedData = {
  user: underfundedUser,
  assets: [{ currentValue: 2000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  liabilities: [],
  transactions: createTransactions(6, 55000, 25000, 10000),
  incomes: [{ amount: 100000, timestamp: new Date('2026-05-01'), source: 'salary' }]
};

console.log('Measuring Base Predictability V2 Latency (Alternatives Skipped)...');
const baseLatencies = [];
for (let i = 0; i < 10; i++) {
  const t0 = performance.now();
  await buildPredictabilitySnapshotAsync(underfundedData, { forecastDate: new Date('2026-06-15'), skipAlternatives: true });
  const t1 = performance.now();
  baseLatencies.push(t1 - t0);
}

console.log('Measuring Predictability with 3 Retirement Alternatives (+2y, +5y, +10y)...');
const withAltLatencies = [];
for (let i = 0; i < 10; i++) {
  const t0 = performance.now();
  await buildPredictabilitySnapshotAsync(underfundedData, { forecastDate: new Date('2026-06-15') });
  const t1 = performance.now();
  withAltLatencies.push(t1 - t0);
}

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { min: min.toFixed(1), median: median.toFixed(1), avg: avg.toFixed(1), max: max.toFixed(1), p95: p95.toFixed(1) };
}

console.log('\n--- Latency Benchmark Results (10,000 Paths, 10 Iterations) ---');
console.log('Base Predictability (No Alternatives):', stats(baseLatencies));
console.log('With 3 Retirement Alternatives:       ', stats(withAltLatencies));
