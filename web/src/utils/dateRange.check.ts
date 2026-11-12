// Self-check for dateRange.ts. Run: node --experimental-strip-types src/utils/dateRange.check.ts
import assert from 'node:assert/strict';
import { bucketIndex, bucketsFor, chartStart, inRange, presetRange } from './dateRange.ts';
import { dateKey, dateKeyToDate, setAppTimezone } from './timezone.ts';

setAppTimezone('Asia/Kolkata');
const now = new Date('2026-11-04T06:00:00Z'); // 4 Nov 2026, 11:30 IST

// Presets
assert.equal(dateKey(presetRange('30d', now).start!), '2026-10-06');
assert.equal(dateKey(presetRange('6m', now).start!), '2026-06-01');
assert.equal(dateKey(presetRange('12m', now).start!), '2025-12-01');
assert.equal(dateKey(presetRange('ytd', now).start!), '2026-01-01');
assert.equal(presetRange('all', now).start, null);
assert.equal(dateKey(presetRange('6m', now).end), '2026-11-04');

// Custom: swapped ends are fixed, future end is capped at today
const c = presetRange('custom', now, { from: '2026-12-01', to: '2026-03-15' });
assert.equal(dateKey(c.start!), '2026-03-15');
assert.equal(dateKey(c.end), '2026-11-04');
const c2 = presetRange('custom', now, { from: '2025-12-20', to: '2026-01-10' });
assert.ok(inRange(dateKeyToDate('2026-01-10', true), c2));
assert.ok(!inRange(dateKeyToDate('2026-01-11'), c2));
assert.equal(presetRange('custom', now, { from: 'junk' }).start, null);

// Daily buckets up to 14 days
const daily = bucketsFor(dateKeyToDate('2026-11-01'), dateKeyToDate('2026-11-04', true));
assert.deepEqual(daily.map((b) => b.key), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);

// Weekly up to 92 days, last bucket clipped
const drilled = bucketsFor(dateKeyToDate('2026-10-01'), dateKeyToDate('2026-10-31', true), { daily: true });
assert.equal(drilled.length, 31);
assert.deepEqual([drilled[0].key, drilled[30].key], ['2026-10-01', '2026-10-31']);

const weekly = bucketsFor(dateKeyToDate('2026-10-06'), dateKeyToDate('2026-11-04', true));
assert.equal(weekly.length, 5);
assert.equal(weekly[0].label, '6–12 Oct');
assert.equal(dateKey(weekly[4].end), '2026-11-04');
assert.equal(weekly[3].label, '27 Oct – 2 Nov');

// Monthly beyond 92 days, crossing a year, first and last clipped
const monthly = bucketsFor(dateKeyToDate('2025-12-20'), dateKeyToDate('2026-03-10', true), { monthly: true });
assert.deepEqual(monthly.map((b) => b.key), ['2025-12', '2026-01', '2026-02', '2026-03']);
assert.equal(dateKey(monthly[0].start), '2025-12-20');
assert.equal(dateKey(monthly[1].end), '2026-01-31');
assert.equal(dateKey(monthly[3].end), '2026-03-10');
assert.equal(bucketIndex(monthly, dateKeyToDate('2026-02-28')), 2);
assert.equal(bucketIndex(monthly, dateKeyToDate('2025-12-19')), -1);
// Boundary: 23:59 IST on 31 Jan is January, 00:00 IST on 1 Feb is February
assert.equal(bucketIndex(monthly, new Date('2026-01-31T18:29:00Z')), 1);
assert.equal(bucketIndex(monthly, new Date('2026-01-31T18:30:00Z')), 2);

const year = bucketsFor(presetRange('12m', now).start!, now);
assert.equal(year.length, 12);
assert.equal(year[0].label, 'Dec 2025');

// "All" starts at the earliest record
assert.equal(dateKey(chartStart(presetRange('all', now), new Date('2025-11-01T10:00:00Z'))), '2025-11-01');
assert.equal(dateKey(chartStart(presetRange('all', now), null)), '2026-06-01');

console.log('dateRange: all checks passed');
