// CSV builders for the Reports export. Same columns as the web app (web/src/utils/csvExport.ts).
import type { IncomeRecord, Liability, MonthlyReport, Transaction } from '../types';

type Cell = string | number | boolean | null | undefined;

/** Escapes one value: RFC 4180 quoting, plus a leading ' on text a spreadsheet would run as a formula. */
export function csvCell(val: Cell): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  let str = val.replace(/\r\n?/g, '\n');
  if (/^\s*[=+\-@\t]/.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const build = (headers: string[], rows: Cell[][]) => [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

// shortcut: dates are UTC days, not the user's timezone; use a timezone-aware key if a late-night entry on the wrong day matters.
const day = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const transactionsToCsv = (list: Transaction[]) => build(
  ['Date', 'Description', 'Category', 'Type', 'Amount', 'Classification Source', 'Is Anomaly'],
  list.map((t) => [day(t.timestamp), t.description || '', t.category || 'Misc', t.type || 'Need', Number(t.amount) || 0, t.classificationSource || 'manual', Boolean(t.isAnomaly)]),
);

export const incomesToCsv = (list: IncomeRecord[]) => build(
  ['Date', 'Source', 'Amount', 'Description'],
  list.map((i) => [day(i.timestamp), i.source || 'salary', Number(i.amount) || 0, i.description || '']),
);

export const liabilitiesToCsv = (list: Liability[]) => build(
  ['Name', 'Category', 'Type', 'Amount', 'Outstanding Balance', 'Interest Rate (%)', 'Frequency', 'Next Due Date', 'Status'],
  list.map((l) => [l.name || '', l.category || '', l.type || 'Need', Number(l.amount) || 0, l.outstandingBalance ?? '', l.interestRate ?? '', l.frequency || 'monthly', day(l.nextDueDate), l.status || 'active']),
);

export const monthlySummariesToCsv = (list: MonthlyReport[]) => build(
  ['Period', 'Total Income', 'Total Expenses', 'Net Cash Flow', 'Savings Rate (%)', 'Needs Spend', 'Wants Spend', 'Investments Spend', 'Average FMI', 'Transaction Count'],
  list.map((m) => [m.periodLabel, m.totalIncome, m.totalExpenses, m.netCashFlow, m.savingsRate, m.spendingMix.Needs, m.spendingMix.Wants, m.spendingMix.Investments, m.fmi.average ?? 'N/A', m.transactionCount]),
);

// Self-check: run with `node --experimental-strip-types src/utils/csv.ts`.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('csv.ts')) {
  const eq = (a: string, b: string) => { if (a !== b) throw new Error(`${a} !== ${b}`); };
  eq(csvCell('a,b'), '"a,b"');
  eq(csvCell('say "hi"'), '"say ""hi"""');
  eq(csvCell('=SUM(A1)'), "'=SUM(A1)");
  eq(csvCell(-5), '-5');
  eq(csvCell(null), '');
  eq(incomesToCsv([{ id: '1', userId: 'u', amount: 100, source: 'salary', description: 'Nov, pay', timestamp: '2026-11-01T10:00:00Z' }]), 'Date,Source,Amount,Description\r\n2026-11-01,salary,100,"Nov, pay"');
  console.log('csv: ok');
}
