import assert from 'node:assert/strict';
import { dueDatesWithin, nextDue } from './bills.ts';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const from = new Date(2026, 9, 29); // Thu 29 Oct 2026

assert.equal(ymd(nextDue({ frequency: 'monthly', dayOfMonth: 5 }, from)), '2026-11-5', 'monthly day already passed rolls to next month');
assert.equal(ymd(nextDue({ frequency: 'monthly', dayOfMonth: 31 }, from)), '2026-10-31', 'monthly later this month');
assert.equal(ymd(nextDue({ frequency: 'monthly', dayOfMonth: 31 }, new Date(2026, 10, 1))), '2026-11-30', 'day 31 clamps to short months');
assert.equal(ymd(nextDue({ frequency: 'weekly', dayOfWeek: 1 }, from)), '2026-11-2', 'next Monday');
assert.equal(ymd(nextDue({ frequency: 'weekly', dayOfWeek: 4 }, from)), '2026-10-29', 'same weekday is today');
assert.equal(ymd(nextDue({ frequency: 'yearly', monthOfYear: 3, dayOfMonth: 15 }, from)), '2027-3-15', 'yearly rolls to next year');
assert.equal(ymd(nextDue({ frequency: 'monthly', dayOfMonth: 1, nextDueDate: '2026-11-20T00:00:00' }, from)), '2026-11-20', 'server nextDueDate wins when in the future');
assert.equal(ymd(nextDue({ frequency: 'monthly', startDate: '2027-01-10T00:00:00' }, from)), '2027-1-10', 'future start date is honoured');

assert.deepEqual(dueDatesWithin({ frequency: 'weekly', dayOfWeek: 1 }, 14, from).map(ymd), ['2026-11-2', '2026-11-9']);
assert.equal(dueDatesWithin({ frequency: 'daily' }, 3, from).length, 3);
assert.deepEqual(dueDatesWithin({ frequency: 'monthly', dayOfMonth: 31 }, 40, from).map(ymd), ['2026-10-31', '2026-11-30']);
console.log('bills ok');
