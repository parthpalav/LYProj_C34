// Self-check for creditCycle.js. Run: node utils/creditCycle.check.js
import assert from 'node:assert/strict';
import { recentStatementCloses, nextStatementClose, dueDateForClose, creditCardSummary } from './creditCycle.js';

const d = (s) => new Date(s + 'T00:00:00.000Z');
const iso = (x) => x.toISOString().slice(0, 10);

// Statement on the 20th, due on the 10th of next month.
let [last, prev] = recentStatementCloses(20, d('2026-11-01'));
assert.equal(iso(last), '2026-10-21');
assert.equal(iso(prev), '2026-09-21');
assert.equal(iso(dueDateForClose(last, 10)), '2026-11-10');
assert.equal(iso(nextStatementClose(20, d('2026-11-01'))), '2026-11-21');

// Purchase on the statement day itself belongs to that statement.
[last] = recentStatementCloses(20, new Date('2026-11-20T23:00:00Z'));
assert.equal(iso(last), '2026-10-21');
[last] = recentStatementCloses(20, d('2026-11-21'));
assert.equal(iso(last), '2026-11-21');

// Day 31 clamps to short months; due day after statement day stays in the same month.
[last] = recentStatementCloses(31, d('2026-03-15'));
assert.equal(iso(last), '2026-03-01'); // Feb 28 statement
assert.equal(iso(nextStatementClose(31, d('2026-03-15'))), '2026-04-01');
assert.equal(iso(dueDateForClose(d('2026-03-06'), 25)), '2026-03-25'); // statement Mar 5, due Mar 25

const card = { creditLimit: 50000, outstanding: 12000, statementDay: 20, dueDay: 10 };
const charges = [
  { amount: 7000, timestamp: d('2026-10-05') }, // billed on Oct 20 statement
  { amount: 5000, timestamp: d('2026-10-25') }  // unbilled
];

let s = creditCardSummary(card, charges, d('2026-11-01'));
assert.equal(s.available, 38000);
assert.equal(s.unbilled, 5000);
assert.equal(s.amountDue, 7000);
assert.equal(iso(s.dueDate), '2026-11-10');
assert.equal(s.overdueAmount, 0);

// Partial payment of 3000 after statement: due drops to 4000.
s = creditCardSummary({ ...card, outstanding: 9000 }, charges, d('2026-11-01'));
assert.equal(s.amountDue, 4000);

// Paid more than billed: nothing due; next due date shown.
s = creditCardSummary({ ...card, outstanding: 2000 }, charges, d('2026-11-01'));
assert.equal(s.amountDue, 0);
assert.equal(iso(s.dueDate), '2026-12-10');

// Paying on the due day itself is on time.
s = creditCardSummary(card, charges, new Date('2026-11-10T20:00:00Z'));
assert.equal(s.overdueAmount, 0);

// Unpaid past due date: overdue.
s = creditCardSummary(card, charges, d('2026-11-12'));
assert.equal(s.overdueAmount, 7000);

// Next statement closes before payment: overdue amount still reported.
s = creditCardSummary(card, charges, d('2026-11-22'));
assert.equal(s.amountDue, 12000);
assert.equal(s.overdueAmount, 7000);
assert.equal(iso(s.dueDate), '2026-12-10');

console.log('creditCycle checks passed');
