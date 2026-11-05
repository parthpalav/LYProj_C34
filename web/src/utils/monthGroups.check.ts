// Self-check for monthGroups.ts. Run: node --experimental-strip-types src/utils/monthGroups.check.ts
import assert from 'node:assert/strict';
import { groupRuns, monthTotals } from './monthGroups.ts';
import { setAppTimezone } from './timezone.ts';

setAppTimezone('Asia/Kolkata');
const tx = (id: string, timestamp: string, amount: number, type: 'Need' | 'Want' | 'Investment') =>
  ({ id, timestamp, amount, type, category: 'Misc', description: id }) as any;

const rows = [
  tx('a', '2026-11-03T10:00:00Z', 500, 'Need'),
  tx('b', '2026-11-01T10:00:00Z', 1000, 'Investment'),
  tx('c', '2026-10-31T20:00:00Z', 200, 'Want'), // 1 Nov 01:30 IST: belongs to November
  tx('d', '2026-10-30T10:00:00Z', 300, 'Want'),
];

const totals = monthTotals(rows);
assert.deepEqual(totals.get('2026-11'), { label: 'November 2026', count: 3, spent: 700, invested: 1000 });
assert.deepEqual(totals.get('2026-10'), { label: 'October 2026', count: 1, spent: 300, invested: 0 });

assert.deepEqual(groupRuns(rows, true).map((g) => [g.key, g.rows.length]), [['2026-11', 3], ['2026-10', 1]]);
assert.deepEqual(groupRuns(rows, false).map((g) => [g.key, g.rows.length]), [[null, 4]]);
assert.deepEqual(groupRuns([], true), []);
console.log('monthGroups: all checks passed');
