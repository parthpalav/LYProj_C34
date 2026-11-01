import type { Asset, Liability, PaymentMethod } from '../types';
import { dateKey } from './timezone.ts';

/** Bills start showing in the bell this many days before they fall due. */
export const DUE_WINDOW_DAYS = 7;

export interface DueAlert {
  id: string;
  kind: 'liability' | 'credit_card';
  title: string;
  amount: number;
  /** Negative = overdue, 0 = today. */
  daysUntil: number;
  dueDate: string;
  overdue: boolean;
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole calendar days from today to `due`, in the app timezone. */
export function daysUntil(due: string | Date, now: Date = new Date()): number {
  return dayNumber(dateKey(due)) - dayNumber(dateKey(now));
}

/** Liabilities and credit-card bills due within `windowDays`, overdue first, then soonest. */
export function buildDueAlerts(
  liabilities: Liability[],
  cards: PaymentMethod[],
  now: Date = new Date(),
  windowDays: number = DUE_WINDOW_DAYS,
): DueAlert[] {
  const out: DueAlert[] = [];

  for (const l of liabilities) {
    if (l.status !== 'active' || !l.nextDueDate || isNaN(new Date(l.nextDueDate).getTime())) continue;
    const d = daysUntil(l.nextDueDate, now);
    // A past nextDueDate on an active liability is the scheduler's job to roll forward; don't call it overdue.
    if (d < 0 || d > windowDays) continue;
    out.push({ id: `l-${l.id}`, kind: 'liability', title: l.name, amount: Number(l.amount) || 0, daysUntil: d, dueDate: l.nextDueDate, overdue: false });
  }

  for (const c of cards) {
    if (c.kind !== 'credit_card' || c.status !== 'active' || !c.credit) continue;
    const { amountDue, overdueAmount, dueDate } = c.credit;
    const overdue = overdueAmount > 0;
    if (!overdue && !(amountDue > 0)) continue;
    const d = daysUntil(dueDate, now);
    if (!overdue && d > windowDays) continue;
    out.push({
      id: `c-${c.id}`, kind: 'credit_card', title: `${c.nickname} bill`,
      amount: overdue ? overdueAmount : amountDue, daysUntil: d, dueDate, overdue: overdue || d < 0,
    });
  }

  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.daysUntil - b.daysUntil);
}

export function dueLabel(a: Pick<DueAlert, 'daysUntil' | 'overdue'>): string {
  if (a.overdue) return a.daysUntil < 0 ? `Overdue by ${-a.daysUntil} day${a.daysUntil === -1 ? '' : 's'}` : 'Overdue';
  if (a.daysUntil === 0) return 'Due today';
  if (a.daysUntil === 1) return 'Due tomorrow';
  return `Due in ${a.daysUntil} days`;
}

/** Fixed-rate deposits: the server computes their value, so they never need a review. */
export const FIXED_INCOME_TYPES = ['Fixed Deposit', 'Recurring Deposit'];
/** Market-linked assets whose value and return drift; the user confirms them monthly. */
export const REVIEW_ASSET_TYPES = ['Mutual Fund', 'Equity', 'Gold', 'Commodities', 'Cryptocurrency'];

/** Same calendar day one month later, clamped to month end (31 Jan -> 28/29 Feb). */
function oneMonthAfter(d: Date): Date {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + 1);
  out.setUTCDate(Math.min(day, new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()));
  return out;
}

/** Market assets not confirmed for a month (falls back to creation date), oldest first. */
export function buildReviewAlerts(assets: Asset[], now: Date = new Date()): Asset[] {
  const lastOf = (a: Asset) => new Date(a.lastReviewedAt || a.createdAt || '');
  return assets
    .filter((a) => REVIEW_ASSET_TYPES.includes(a.assetType))
    .filter((a) => { const last = lastOf(a); return !isNaN(last.getTime()) && oneMonthAfter(last) <= now; })
    .sort((a, b) => lastOf(a).getTime() - lastOf(b).getTime());
}
