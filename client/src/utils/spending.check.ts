import assert from 'node:assert/strict';
import { addDays, bucketLabel, buildSeries, indexAtX, rangeFor, spanLabel, yTicks } from './spending.ts';
import { formatCompact } from './format.ts';

const now = new Date(2026, 9, 29, 15, 30); // 29 Oct 2026, afternoon
const at = (m: number, d: number, h = 12, y = 2026) => new Date(y, m, d, h).toISOString();
const tx = [
  { amount: 500, timestamp: at(9, 14, 9), type: 'Need' as const },
  { amount: 200, timestamp: at(9, 14, 23), type: 'Want' as const },
  { amount: 1000, timestamp: at(9, 20), type: 'Investment' as const },
  { amount: -300, timestamp: at(9, 29, 8), type: 'Want' as const }, // sign ignored, like the rest of the app
  { amount: 999, timestamp: at(10, 5) }, // scheduled for next month: not plotted
];

// Presets
const week = rangeFor('week', now);
assert.equal(week.start.getDate(), 23);
assert.equal(week.end.getDate(), 29);
assert.equal(rangeFor('month', now).start.getDate(), 1);
const year = rangeFor('year', now);
assert.deepEqual([year.start.getFullYear(), year.start.getMonth(), year.start.getDate()], [2025, 9, 30]);
// Custom never runs past today
assert.equal(rangeFor('custom', now, { start: new Date(2026, 9, 1), end: new Date(2026, 11, 31) }).end.getTime(), new Date(2026, 9, 29).getTime());

// Month: history starts on the 14th, so the series starts there and says so
const month = buildSeries(tx, rangeFor('month', now).start, now);
assert.equal(month.clamped, true);
assert.equal(month.from.getDate(), 14);
assert.equal(month.bucketDays, 1);
assert.equal(month.buckets.length, 16); // 14th..29th inclusive
assert.deepEqual(
  { total: month.buckets[0].total, count: month.buckets[0].count, Need: month.buckets[0].Need, Want: month.buckets[0].Want },
  { total: 700, count: 2, Need: 500, Want: 200 },
);
assert.equal(month.buckets[6].Investment, 1000);
assert.equal(month.buckets[15].total, 300);
assert.equal(month.buckets.reduce((s, b) => s + b.total, 0), 2000);

// Week: entirely inside history, not clamped, 7 daily points
const w = buildSeries(tx, week.start, week.end);
assert.equal(w.clamped, false);
assert.equal(w.buckets.length, 7);
assert.equal(w.buckets.reduce((s, b) => s + b.total, 0), 300);

// Year: clamped to the first transaction; 16 days is short enough to stay daily
const y = buildSeries(tx, year.start, year.end);
assert.equal(y.clamped, true);
assert.equal(y.from.getDate(), 14);
assert.equal(y.bucketDays, 1);

// A long history switches to weekly points that still add up
const long = [...tx, { amount: 50, timestamp: at(0, 3, 12, 2026), type: 'Need' as const }];
const ly = buildSeries(long, year.start, year.end);
assert.equal(ly.bucketDays, 7);
assert.equal(ly.from.getMonth(), 0);
assert.equal(ly.buckets.reduce((s, b) => s + b.total, 0), 2050);
assert.equal(ly.buckets.at(-1)!.end.getTime(), new Date(2026, 9, 29).getTime());
assert.ok(ly.buckets.every((b, i) => i === 0 || b.start.getTime() === addDays(ly.buckets[i - 1].end, 1).getTime()), 'weeks are contiguous');

// A custom range before any history has nothing to plot
assert.equal(buildSeries(tx, new Date(2026, 0, 1), new Date(2026, 1, 1)).buckets.length, 0);
assert.equal(buildSeries([], week.start, week.end).buckets.length, 0);

// Axis and scrubbing helpers
assert.deepEqual(yTicks(15000), [0, 5000, 10000, 15000]);
assert.deepEqual(yTicks(1800), [0, 500, 1000, 1500, 2000]);
assert.deepEqual(yTicks(0), [0, 25]);
assert.equal(indexAtX(0, 300, 16), 0);
assert.equal(indexAtX(300, 300, 16), 15);
assert.equal(indexAtX(-40, 300, 16), 0);
assert.equal(indexAtX(999, 300, 16), 15);
assert.equal(indexAtX(150, 300, 3), 1);
assert.equal(indexAtX(10, 300, 1), 0);
assert.equal(formatCompact(850), '₹850');
assert.equal(formatCompact(2500), '₹2.5k');
assert.equal(formatCompact(15000), '₹15k');
assert.equal(formatCompact(120000), '₹1.2L');
assert.equal(spanLabel(new Date(2026, 9, 14), new Date(2026, 9, 29)), '14 – 29 Oct');
assert.ok(bucketLabel(month.buckets[0]).includes('14'));
console.log('spending ok');
