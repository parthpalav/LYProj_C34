// Self-check for calculateNextDueDate. Run: node utils/nextDueDate.check.js
import assert from 'node:assert/strict';
import { calculateNextDueDate } from '../controllers/liabilityController.js';

const iso = (d) => d.toISOString();
const bill = (extra) => ({ autoDeduct: true, startDate: new Date('2026-01-01T00:00:00Z'), ...extra });
const monthly10 = bill({ frequency: 'monthly', dayOfMonth: 10 });
const UTC = 'UTC';

// The reported bug: created before the due day -> due this month, not next.
assert.equal(iso(calculateNextDueDate(monthly10, new Date('2026-11-01T09:00:00Z'), UTC, { inclusive: true })), '2026-11-10T00:00:00.000Z');
// Created on the due day -> due today.
assert.equal(iso(calculateNextDueDate(monthly10, new Date('2026-11-10T09:00:00Z'), UTC, { inclusive: true })), '2026-11-10T00:00:00.000Z');
// Created after the due day -> next month.
assert.equal(iso(calculateNextDueDate(monthly10, new Date('2026-11-11T09:00:00Z'), UTC, { inclusive: true })), '2026-12-10T00:00:00.000Z');
// After charging the Nov 10 occurrence -> Dec 10.
assert.equal(iso(calculateNextDueDate(monthly10, new Date('2026-11-10T00:00:00Z'), UTC)), '2026-12-10T00:00:00.000Z');
// Future start date wins over today.
assert.equal(iso(calculateNextDueDate({ ...monthly10, startDate: new Date('2026-12-15T00:00:00Z') }, new Date('2026-11-01T00:00:00Z'), UTC, { inclusive: true })), '2027-01-10T00:00:00.000Z');
assert.equal(iso(calculateNextDueDate({ ...monthly10, startDate: new Date('2026-12-05T00:00:00Z') }, new Date('2026-11-01T00:00:00Z'), UTC, { inclusive: true })), '2026-12-10T00:00:00.000Z');

// Yearly had the same bug: Feb 29 bill created on Jan 15 2024 -> Feb 29 2024.
const yearly = bill({ frequency: 'yearly', monthOfYear: 2, dayOfMonth: 29, startDate: new Date('2024-01-01T00:00:00Z') });
assert.equal(iso(calculateNextDueDate(yearly, new Date('2024-01-15T10:00:00Z'), UTC, { inclusive: true })), '2024-02-29T00:00:00.000Z');
assert.equal(iso(calculateNextDueDate(yearly, new Date('2024-02-29T00:00:00Z'), UTC)), '2025-02-28T00:00:00.000Z');

// Weekly and daily: today counts on creation, not after a charge.
const weeklyMon = bill({ frequency: 'weekly', dayOfWeek: 1 });
assert.equal(iso(calculateNextDueDate(weeklyMon, new Date('2026-11-02T08:00:00Z'), UTC, { inclusive: true })), '2026-11-02T00:00:00.000Z'); // a Monday
assert.equal(iso(calculateNextDueDate(weeklyMon, new Date('2026-11-02T00:00:00Z'), UTC)), '2026-11-09T00:00:00.000Z');
const daily = bill({ frequency: 'daily' });
assert.equal(iso(calculateNextDueDate(daily, new Date('2026-11-02T08:00:00Z'), UTC, { inclusive: true })), '2026-11-02T00:00:00.000Z');
assert.equal(iso(calculateNextDueDate(daily, new Date('2026-11-02T00:00:00Z'), UTC)), '2026-11-03T00:00:00.000Z');

// IST: 20:00Z on Oct 31 is already Nov 1 in India, so a bill due on the 1st is due "today" (Nov 1 IST).
const monthly1 = bill({ frequency: 'monthly', dayOfMonth: 1 });
assert.equal(iso(calculateNextDueDate(monthly1, new Date('2026-10-31T20:00:00Z'), 'Asia/Kolkata', { inclusive: true })), '2026-10-31T18:30:00.000Z');
// Old bills stored at UTC midnight (05:30 IST) still advance one cycle after a charge.
assert.equal(iso(calculateNextDueDate(monthly10, new Date('2026-11-10T00:00:00Z'), 'Asia/Kolkata')), '2026-12-09T18:30:00.000Z');

// autoDeduct off -> no due date.
assert.equal(calculateNextDueDate({ ...monthly10, autoDeduct: false }, new Date(), UTC), null);

console.log('nextDueDate checks passed');
