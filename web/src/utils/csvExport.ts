/**
 * web/src/utils/csvExport.ts
 * 
 * Secure, client-side CSV serialization and download utility.
 * Features:
 *  - Formula-injection sanitization for user-controlled strings (=, +, -, @, \t, \r)
 *  - Standard RFC 4180 CSV escaping (double-quotes, commas, newlines)
 *  - UTF-8 BOM encoding for seamless Excel / Google Sheets compatibility
 *  - Raw unformatted numeric values for mathematical utility
 *  - ISO standardized date serialization
 */

import type { Transaction, IncomeRecord, Liability } from '../types';

/**
 * Formula triggers that could execute malicious spreadsheet formulas
 * in Microsoft Excel, Google Sheets, or LibreOffice Calc.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a string value against spreadsheet formula injection.
 * If the string begins with a dangerous prefix, it is prepended with a single quote (').
 */
export function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  // Handle numbers, booleans directly
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  // Handle Dates
  if (val instanceof Date) {
    return val.toISOString();
  }

  let str = String(val);

  // Strip carriage returns inside string
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check formula injection prefixes on both raw string and trimmed string
  const hasFormulaPrefix = FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix) || str.trimStart().startsWith(prefix));
  if (hasFormulaPrefix) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: if contains quote, comma, or newline, escape quotes as "" and wrap in ""
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string from an array of headers and rows.
 * Adds UTF-8 Byte Order Mark (BOM) to guarantee clean character encoding across Excel/Sheets.
 */
export function buildCsvContent(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(sanitizeCsvValue).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvValue).join(','));
  const csvBody = [headerLine, ...rowLines].join('\r\n');
  return `\uFEFF${csvBody}`;
}

/**
 * Triggers a browser download of a CSV file.
 */
export function triggerCsvDownload(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Dataset Formatters ─────────────────────────────────────────

export function transactionsToCsv(transactions: Transaction[]): string {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Type',
    'Amount',
    'Classification Source',
    'Is Anomaly'
  ];

  const rows = transactions.map((tx) => [
    tx.timestamp ? new Date(tx.timestamp).toISOString().slice(0, 10) : '',
    tx.description || '',
    tx.category || 'Misc',
    tx.type || 'Need',
    Number(tx.amount) || 0,
    tx.classificationSource || 'manual',
    Boolean(tx.isAnomaly)
  ]);

  return buildCsvContent(headers, rows);
}

export function incomesToCsv(incomes: IncomeRecord[]): string {
  const headers = ['Date', 'Source', 'Amount', 'Description'];

  const rows = incomes.map((inc) => [
    inc.timestamp ? new Date(inc.timestamp).toISOString().slice(0, 10) : '',
    inc.source || 'salary',
    Number(inc.amount) || 0,
    inc.description || ''
  ]);

  return buildCsvContent(headers, rows);
}

export function liabilitiesToCsv(liabilities: Liability[]): string {
  const headers = [
    'Name',
    'Category',
    'Type',
    'Amount',
    'Outstanding Balance',
    'Interest Rate (%)',
    'Frequency',
    'Next Due Date',
    'Status'
  ];

  const rows = liabilities.map((l) => [
    l.name || '',
    l.category || '',
    l.type || 'Need',
    Number(l.amount) || 0,
    l.outstandingBalance !== null && l.outstandingBalance !== undefined ? Number(l.outstandingBalance) : '',
    l.interestRate !== null && l.interestRate !== undefined ? Number(l.interestRate) : '',
    l.frequency || 'monthly',
    l.nextDueDate ? new Date(l.nextDueDate).toISOString().slice(0, 10) : '',
    l.status || 'active'
  ]);

  return buildCsvContent(headers, rows);
}

export interface MonthlyCsvRow {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  needsSpend: number;
  wantsSpend: number;
  investmentsSpend: number;
  fmiAverage: number | string;
  transactionCount: number;
}

export function monthlySummariesToCsv(summaries: MonthlyCsvRow[]): string {
  const headers = [
    'Period',
    'Total Income',
    'Total Expenses',
    'Net Cash Flow',
    'Savings Rate (%)',
    'Needs Spend',
    'Wants Spend',
    'Investments Spend',
    'Average FMI',
    'Transaction Count'
  ];

  const rows = summaries.map((s) => [
    s.period,
    s.totalIncome,
    s.totalExpenses,
    s.netCashFlow,
    s.savingsRate,
    s.needsSpend,
    s.wantsSpend,
    s.investmentsSpend,
    s.fmiAverage !== null && s.fmiAverage !== undefined ? s.fmiAverage : 'N/A',
    s.transactionCount
  ]);

  return buildCsvContent(headers, rows);
}
