/**
 * Overview month figures with each combination of successful and failed
 * income / expense requests. A failed list must make derived figures
 * unavailable (null), never ₹0 spending and a 100% savings rate.
 *
 * Loads the real TypeScript module through Vite's SSR loader.
 * Run: node web/tests/overview/overviewFigures.test.mjs
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vite = await createServer({ root: webRoot, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false } });

try {
  const { summarizeCurrentMonth } = await vite.ssrLoadModule('/src/services/dashboard.ts');
  const now = new Date();
  const incomes = [{ id: 'i1', amount: 10000, source: 'salary', timestamp: now.toISOString() }];
  const txs = [{ id: 't1', amount: 4000, category: 'Groceries', type: 'Need', timestamp: now.toISOString() }];

  // 1. Both loaded
  assert.deepEqual(summarizeCurrentMonth(txs, incomes, now), { currentMonthIncome: 10000, currentMonthSpending: 4000, currentMonthNetFlow: 6000, savingsRate: 60 });

  // 2. Expenses failed: income stays visible, nothing derived
  assert.deepEqual(summarizeCurrentMonth(null, incomes, now), { currentMonthIncome: 10000, currentMonthSpending: null, currentMonthNetFlow: null, savingsRate: null });

  // 3. Income failed: spending stays visible, nothing derived
  assert.deepEqual(summarizeCurrentMonth(txs, null, now), { currentMonthIncome: null, currentMonthSpending: 4000, currentMonthNetFlow: null, savingsRate: null });

  // 4. Both failed
  assert.deepEqual(summarizeCurrentMonth(null, null, now), { currentMonthIncome: null, currentMonthSpending: null, currentMonthNetFlow: null, savingsRate: null });

  // Loaded but empty is real data, not an outage
  assert.deepEqual(summarizeCurrentMonth([], incomes, now), { currentMonthIncome: 10000, currentMonthSpending: 0, currentMonthNetFlow: 10000, savingsRate: 100 });
  console.log('overviewFigures: all checks passed');
} finally {
  await vite.close();
}
