import type { Transaction } from '../types';
import { getAppTimezone, zparts } from './timezone.ts';

export interface MonthTotal { label: string; count: number; spent: number; invested: number }
export interface MonthGroup { key: string | null; rows: Transaction[] }

const txDate = (tx: Transaction) => new Date(tx.timestamp);

/** "2026-11" for the transaction's month in the app timezone. */
export function monthOf(tx: Transaction): string {
  const z = zparts(txDate(tx));
  return `${z.year}-${String(z.month + 1).padStart(2, '0')}`;
}

/** Per-month count, spend (Need + Want) and investment over every filtered row, not only the visible ones. */
export function monthTotals(txs: Transaction[]): Map<string, MonthTotal> {
  const fmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: getAppTimezone() });
  const map = new Map<string, MonthTotal>();
  for (const tx of txs) {
    const key = monthOf(tx);
    let m = map.get(key);
    if (!m) map.set(key, (m = { label: fmt.format(txDate(tx)), count: 0, spent: 0, invested: 0 }));
    const amt = Number(tx.amount) || 0;
    m.count += 1;
    if (tx.type === 'Investment') m.invested += amt;
    else m.spent += amt;
  }
  return map;
}

/** Consecutive runs of the same month, in the order given; one headerless group when not grouping. */
export function groupRuns(txs: Transaction[], byMonth: boolean): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const tx of txs) {
    const key = byMonth ? monthOf(tx) : null;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(tx);
    else groups.push({ key, rows: [tx] });
  }
  return groups;
}
