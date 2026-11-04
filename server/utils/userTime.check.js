// Self-check for userTime.js. Run: node utils/userTime.check.js
import assert from 'node:assert/strict';
import { toZoned, fromZoned, zonedDateKey, zonedHour, zonedMonthStart, zonedDayStart, resolveTimezone } from './userTime.js';

const at = (s) => new Date(s);

// IST is +05:30: 20:00Z is 01:30 next day in India.
assert.equal(zonedDateKey(at('2026-10-31T20:00:00Z'), 'Asia/Kolkata'), '2026-11-01');
assert.equal(zonedHour(at('2026-10-31T20:00:00Z'), 'Asia/Kolkata'), 1);
assert.equal(zonedMonthStart(at('2026-10-31T20:00:00Z'), 'Asia/Kolkata').toISOString(), '2026-10-31T18:30:00.000Z');
assert.equal(zonedMonthStart(at('2026-11-15T00:00:00Z'), 'Asia/Kolkata', 1).toISOString(), '2026-11-30T18:30:00.000Z');
assert.equal(zonedDayStart(at('2026-11-15T10:00:00Z'), 'Asia/Kathmandu').toISOString(), '2026-11-14T18:15:00.000Z');

// New York, both sides of DST (ends 2026-11-01 at 02:00 local).
assert.equal(zonedDateKey(at('2026-11-01T03:00:00Z'), 'America/New_York'), '2026-10-31');
assert.equal(fromZoned(new Date(Date.UTC(2026, 9, 15)), 'America/New_York').toISOString(), '2026-10-15T04:00:00.000Z');
assert.equal(fromZoned(new Date(Date.UTC(2026, 10, 15)), 'America/New_York').toISOString(), '2026-11-15T05:00:00.000Z');

// Round trip.
for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'Australia/Sydney', 'UTC']) {
  const t = at('2026-03-29T12:34:56Z');
  assert.equal(fromZoned(toZoned(t, tz), tz).getTime(), t.getTime(), tz);
}

assert.equal(resolveTimezone('Mars/Base'), 'Asia/Kolkata');
assert.equal(resolveTimezone(undefined), 'Asia/Kolkata');

console.log('userTime checks passed');
