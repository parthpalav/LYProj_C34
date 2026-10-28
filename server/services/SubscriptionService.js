import { merchantKey } from './MerchantMemoryService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Gap ranges (days) between charges that still count as the same cadence.
const CADENCES = [
  { frequency: 'weekly', min: 5, max: 9 },
  { frequency: 'monthly', min: 25, max: 35 },
];
const AMOUNT_TOLERANCE = 0.1;
const MIN_OCCURRENCES = 3;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Group key: the first merchant token, so "Netflix" and "Netflix premium" land together. */
const groupKey = (description) => merchantKey(description).split(' ')[0] || '';

/**
 * Finds charges that repeat on a weekly or monthly rhythm at about the same amount, which are
 * probably subscriptions or bills the user hasn't set up as a liability yet.
 * Transactions already linked to a liability, and merchants matching an existing liability name, are skipped.
 */
export function detectRecurring(transactions = [], liabilities = []) {
  const tracked = new Set(liabilities.map((l) => groupKey(l.name)).filter(Boolean));
  const groups = new Map();
  for (const t of transactions) {
    if (t.liabilityId || !(Number(t.amount) > 0) || !t.timestamp) continue;
    const key = groupKey(t.description);
    if (!key || tracked.has(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const suggestions = [];
  for (const [key, txs] of groups) {
    if (txs.length < MIN_OCCURRENCES) continue;
    txs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const gaps = txs.slice(1).map((t, i) => (new Date(t.timestamp) - new Date(txs[i].timestamp)) / DAY_MS);
    const typicalGap = median(gaps);
    const cadence = CADENCES.find((c) => typicalGap >= c.min && typicalGap <= c.max);
    if (!cadence || gaps.some((g) => g < cadence.min || g > cadence.max)) continue;

    const amounts = txs.map((t) => Number(t.amount));
    const typicalAmount = median(amounts);
    const steady = amounts.filter((a) => Math.abs(a - typicalAmount) <= typicalAmount * AMOUNT_TOLERANCE).length;
    if (steady / amounts.length < 0.8) continue;

    const last = txs[txs.length - 1];
    suggestions.push({
      key,
      name: last.description,
      amount: Math.round(typicalAmount),
      frequency: cadence.frequency,
      occurrences: txs.length,
      lastDate: new Date(last.timestamp).toISOString(),
      nextExpected: new Date(new Date(last.timestamp).getTime() + typicalGap * DAY_MS).toISOString(),
      category: last.category,
      type: last.type,
    });
  }
  return suggestions.sort((a, b) => b.amount - a.amount);
}
