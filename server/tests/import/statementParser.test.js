// Pure parser tests for bank statement import (no DB, no network).
import '../setupEnv.js';
import assert from 'node:assert/strict';
import {
  parseAmount, parseStatementDate, parseCsvStatement, parseStatementLines,
  importHash, balancesAddUp, maskLongNumbers, validateCommitRows,
} from '../../services/StatementImportService.js';

const TZ = 'Asia/Kolkata';
const day = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

test('parseAmount handles Indian grouping, symbols and Cr/Dr', () => {
  assert.equal(parseAmount('1,23,456.78').value, 123456.78);
  assert.deepEqual(parseAmount('₹ 500.00 Cr'), { value: 500, marker: 'cr', negative: false });
  assert.equal(parseAmount('-250.50').negative, true);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('-'), null);
  assert.equal(parseAmount('abc'), null);
});

test('parseStatementDate is day-first and keeps the calendar day', () => {
  assert.equal(day(parseStatementDate('03/04/2026', TZ)), '2026-04-03');
  assert.equal(day(parseStatementDate('03-04-26', TZ)), '2026-04-03');
  assert.equal(day(parseStatementDate('05-Apr-2026', TZ)), '2026-04-05');
  assert.equal(day(parseStatementDate('05 Apr 2026', TZ)), '2026-04-05');
  assert.equal(day(parseStatementDate('2026-04-05', TZ)), '2026-04-05');
  assert.equal(parseStatementDate('31/02/2026', TZ), null);
  assert.equal(parseStatementDate('Opening Balance', TZ), null);
});

test('HDFC-style CSV: preamble, split withdrawal/deposit columns, separator row', () => {
  const csv = [
    'HDFC BANK Ltd.,,,,,,',
    'Account No :,XXXXXXXX1234,,,,,',
    'Statement From : 01/04/2026 To : 30/04/2026,,,,,,',
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '********,********,********,********,********,********,********',
    '01/04/26,UPI-SWIGGY-swiggy@icici-ICIC0000001-610012345678-food,0000610012345678,01/04/26,450.00,,"49,550.00"',
    '02/04/26,"NEFT CR-ACME CORP-SALARY APR",N123,02/04/26,,"85,000.00","1,34,550.00"',
    '03/04/26,POS 4321XXXXXX1234 AMAZON PAY,0000,03/04/26,"1,299.00",,"1,33,251.00"',
    'STATEMENT SUMMARY :-,,,,,,',
  ].join('\n');
  const { rows, meta } = parseCsvStatement(csv, TZ);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.direction), ['debit', 'credit', 'debit']);
  assert.deepEqual(rows.map((r) => r.amount), [450, 85000, 1299]);
  assert.equal(rows[1].balance, 134550);
  assert.match(rows[0].description, /SWIGGY/);
  assert.equal(meta.openingBalance, 50000);
  assert.equal(meta.closingBalance, 133251);
  assert.equal(meta.last4, '1234');
});

test('SBI-style CSV: newest first, single amount + Dr/Cr column', () => {
  const csv = [
    'Txn Date,Value Date,Description,Ref No./Cheque No.,Amount,Dr / Cr,Balance',
    '10 Apr 2026,10 Apr 2026,TO TRANSFER-UPI/DR/612345/ZOMATO,612345,320.00,DR,9680.00',
    '08 Apr 2026,08 Apr 2026,BY TRANSFER-NEFT*REFUND,NEFT1,"5,000.00",CR,"10,000.00"',
  ].join('\n');
  const { rows } = parseCsvStatement(csv, TZ);
  assert.equal(rows.length, 2);
  assert.equal(day(rows[0].date), '2026-04-08'); // reordered oldest first
  assert.deepEqual(rows.map((r) => r.direction), ['credit', 'debit']);
});

test('CSV without a transaction table is rejected', () => {
  assert.throws(() => parseCsvStatement('name,age\nasha,30', TZ), (e) => e.code === 'NO_HEADER');
});

test('local PDF line parser: balance-delta direction, value date, multi-line narration', () => {
  const lines = [
    'Statement of Account',
    'Opening Balance   20,000.00',
    'Date   Value Date   Narration   Withdrawal   Deposit   Balance',
    '01/04/2026   01/04/2026   UPI/DR/612233445566/BLINKIT   612.00   19,388.00',
    'GROCERY ORDER',
    '05/04/2026   05/04/2026   IMPS/P2A/RAHUL SHARMA   2,000.00   21,388.00',
    '07/04/2026   NETFLIX.COM   0.00   0.00   21,388.00',
    '09/04/2026   ATM WDL MUMBAI   0.00   0.00   0.00',
    '12/04/2026   RENT APRIL   15,000.00   0.00   6,388.00',
    'Page 1 of 2',
  ];
  const { rows, meta } = parseStatementLines(lines, TZ);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => [r.amount, r.direction]), [[612, 'debit'], [2000, 'credit'], [15000, 'debit']]);
  assert.match(rows[0].description, /BLINKIT GROCERY ORDER/);
  assert.equal(meta.openingBalance, 20000);
  assert.equal(meta.closingBalance, 6388);
});

test('balancesAddUp catches rows that do not match the running balance', () => {
  const good = [{ amount: 100, direction: 'debit', balance: 900 }, { amount: 50, direction: 'credit', balance: 950 }, { amount: 10, direction: 'debit', balance: 940 }];
  assert.equal(balancesAddUp(good, 1000), true);
  const bad = good.map((r) => ({ ...r, direction: r.direction === 'debit' ? 'credit' : 'debit' }));
  assert.equal(balancesAddUp(bad, 1000), false);
});

test('importHash is stable and separates identical same-day rows by occurrence', () => {
  const row = { date: parseStatementDate('01/04/2026', TZ), amount: 100, direction: 'debit', balance: 900, description: 'x' };
  assert.equal(importHash('u1', row, TZ, 0), importHash('u1', { ...row }, TZ, 0));
  assert.notEqual(importHash('u1', row, TZ, 0), importHash('u1', row, TZ, 1));
  assert.notEqual(importHash('u1', row, TZ, 0), importHash('u2', row, TZ, 0));
});

test('maskLongNumbers keeps only the last 4 digits of account/ref numbers', () => {
  assert.equal(maskLongNumbers('A/C 123456789012 paid 1,299.00'), 'A/C XXXXXXXX9012 paid 1,299.00');
});

test('validateCommitRows rejects bad rows and normalises labels', () => {
  const rowId = 'a'.repeat(40);
  const [r] = validateCommitRows([{ rowId, amount: '12.5', date: '2026-04-01T06:30:00Z', direction: 'debit', category: 'shopping', type: 'Want' }]);
  assert.equal(r.category, 'Shopping');
  // Model and rule sources survive the commit; unknown strings fall back to 'unknown'.
  const sourceOf = (classificationSource) => validateCommitRows([{ rowId, amount: 1, date: '2026-04-01', direction: 'debit', classificationSource }])[0].classificationSource;
  assert.equal(sourceOf('finaura_v7'), 'finaura_v7');
  assert.equal(sourceOf('merchant_rule'), 'merchant_rule');
  assert.equal(sourceOf('bogus'), 'unknown');
  assert.throws(() => validateCommitRows([{ rowId, amount: -1, date: '2026-04-01', direction: 'debit' }]), /positive/);
  assert.throws(() => validateCommitRows([{ rowId: 'x', amount: 1, date: '2026-04-01', direction: 'debit' }]), /row id/);
  assert.throws(() => validateCommitRows([]), (e) => e.code === 'NO_ROWS');
});

console.log(`statementParser: ${passed} passed`);
