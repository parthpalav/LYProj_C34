// Self-check for timezone.ts. Run: node --experimental-strip-types src/utils/timezone.check.ts
import assert from 'node:assert/strict';
import { zparts, zdate, dateKey, dateKeyToDate, setAppTimezone, startOfDay, daysInMonth } from './timezone.ts';

setAppTimezone('Asia/Kolkata');
assert.equal(dateKey('2026-10-31T20:00:00Z'), '2026-11-01');
assert.equal(zparts('2026-10-31T20:00:00Z').hours, 1);
assert.equal(zparts('2026-11-01T06:00:00Z').weekday, 0); // Sunday
assert.equal(zdate(2026, 10, 1).toISOString(), '2026-10-31T18:30:00.000Z');
assert.equal(zdate(2026, 12, 1).toISOString(), '2026-12-31T18:30:00.000Z'); // month overflow
assert.equal(dateKeyToDate('2026-11-10', true).toISOString(), '2026-11-10T18:29:59.999Z');
assert.equal(startOfDay('2026-11-01T20:00:00Z', -1).toISOString(), '2026-10-31T18:30:00.000Z'); // 01:30 Nov 2 IST, minus a day
assert.equal(daysInMonth(2028, 1), 29);

setAppTimezone('America/New_York');
assert.equal(dateKey('2026-11-01T03:00:00Z'), '2026-10-31');
assert.equal(zdate(2026, 9, 15).toISOString(), '2026-10-15T04:00:00.000Z'); // EDT
assert.equal(zdate(2026, 10, 15).toISOString(), '2026-11-15T05:00:00.000Z'); // EST

setAppTimezone('Nowhere/Fake');
assert.equal(dateKey('2026-10-31T20:00:00Z'), '2026-11-01'); // falls back to IST

console.log('timezone checks passed');
