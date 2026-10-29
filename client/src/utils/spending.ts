// Pure helpers for the spending chart; no React Native imports so `spending.check.ts` runs under Node.

export type SpendType = 'Need' | 'Want' | 'Investment';
export type RangeKind = 'week' | 'month' | 'year' | 'custom';
type Spend = { amount: number; timestamp: string; type?: SpendType };

export type Bucket = { start: Date; end: Date; total: number; count: number } & Record<SpendType, number>;

export type Series = {
  buckets: Bucket[];
  /** first day actually plotted: the range start, or the first transaction if history starts later */
  from: Date;
  to: Date;
  /** true when the requested range began before the user's first transaction */
  clamped: boolean;
  /** 1 = one point per day, 7 = one per week (long ranges) */
  bucketDays: 1 | 7;
};

const DAY_MS = 86_400_000;
/** Longer ranges switch to weekly points so a year stays readable. */
const DAILY_LIMIT = 92;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Rounded so a DST shift (23 or 25 hour day) still counts as one day.
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

/** Inclusive start and end day for a preset; `custom` is clipped so it never runs past today. */
export function rangeFor(kind: RangeKind, now: Date, custom?: { start: Date; end: Date }): { start: Date; end: Date } {
  const today = startOfDay(now);
  switch (kind) {
    case 'week':
      return { start: addDays(today, -6), end: today };
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    case 'year':
      return { start: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1), end: today };
    case 'custom': {
      const start = startOfDay(custom?.start ?? today);
      const end = startOfDay(custom?.end ?? today);
      return { start, end: end > today ? today : end };
    }
  }
}

/** Totals per day (or week) between start and end, beginning no earlier than the first transaction. */
export function buildSeries(txs: Spend[], start: Date, end: Date): Series {
  const dated = txs
    .map((t) => ({ t, day: startOfDay(new Date(t.timestamp)) }))
    .filter((x) => Number.isFinite(x.day.getTime()));
  const first = dated.reduce<Date | null>((min, x) => (!min || x.day < min ? x.day : min), null);
  const from = first && first > start ? first : startOfDay(start);
  const to = startOfDay(end);
  const clamped = !!first && first > startOfDay(start);
  if (!first || from > to) return { buckets: [], from, to, clamped, bucketDays: 1 };

  const days = daysBetween(from, to) + 1;
  const bucketDays = days > DAILY_LIMIT ? 7 : 1;
  const buckets: Bucket[] = Array.from({ length: Math.ceil(days / bucketDays) }, (_, i) => ({
    start: addDays(from, i * bucketDays),
    end: addDays(from, Math.min(days, (i + 1) * bucketDays) - 1),
    total: 0, count: 0, Need: 0, Want: 0, Investment: 0,
  }));
  for (const { t, day } of dated) {
    const i = daysBetween(from, day);
    if (i < 0 || i >= days) continue; // outside the range, including future-dated scheduled payments
    const b = buckets[Math.floor(i / bucketDays)];
    const amount = Math.abs(t.amount);
    b.total += amount;
    b.count += 1;
    if (t.type) b[t.type] += amount;
  }
  return { buckets, from, to, clamped, bucketDays };
}

/** Evenly spaced gridline values from 0 up to a round number at or above `max`. */
export function yTicks(max: number, target = 4): number[] {
  const raw = Math.max(max, 100) / target;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Nearest point for a finger at `x` across a chart `width` wide holding `count` points. */
export function indexAtX(x: number, width: number, count: number): number {
  'worklet';
  if (count <= 1 || width <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round((x / width) * (count - 1))));
}

const dayMonth = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** "Tue, 21 Oct" for a day, "12 – 18 Oct" (or "28 Sep – 4 Oct") for a week. */
export function bucketLabel(b: Bucket): string {
  if (b.start.getTime() === b.end.getTime()) {
    return b.start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return spanLabel(b.start, b.end);
}

/** "14 – 29 Oct", "28 Sep – 4 Oct" or "30 Oct 2025 – 29 Oct 2026". */
export function spanLabel(a: Date, b: Date): string {
  if (a.getTime() === b.getTime()) return dayMonth(a);
  if (a.getFullYear() !== b.getFullYear()) {
    const full = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${full(a)} – ${full(b)}`;
  }
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${dayMonth(b)}`;
  return `${dayMonth(a)} – ${dayMonth(b)}`;
}
