// Date ranges and chart buckets for the history filters, in the app timezone.
// History is never trimmed: "All" starts at the earliest record the caller passes in.
import { dateKey, dateKeyToDate, getAppTimezone, zdate, zparts } from './timezone.ts';

export type RangePreset = '30d' | '3m' | '6m' | '12m' | 'ytd' | 'all' | 'custom';

export const RANGE_PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '12m', label: '12M' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
];

/** Inclusive range. start null = from the first record. */
export interface DateRange {
  start: Date | null;
  end: Date;
}

export interface Bucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

const KEY = /^\d{4}-\d{2}-\d{2}$/;
export const isDateKey = (v: unknown): v is string => typeof v === 'string' && KEY.test(v);

export function isRangePreset(v: unknown): v is RangePreset {
  return RANGE_PRESETS.some((p) => p.id === v);
}

/** 3M / 6M / 12M are calendar months including the current one, like the monthly reports. */
export function presetRange(preset: RangePreset, now = new Date(), custom?: { from?: string | null; to?: string | null }): DateRange {
  const p = zparts(now);
  const end = zdate(p.year, p.month, p.day, 23, 59, 59, 999);
  switch (preset) {
    case '30d':
      return { start: zdate(p.year, p.month, p.day - 29), end };
    case '3m':
    case '6m':
    case '12m':
      return { start: zdate(p.year, p.month - (parseInt(preset, 10) - 1), 1), end };
    case 'ytd':
      return { start: zdate(p.year, 0, 1), end };
    case 'all':
      return { start: null, end };
    case 'custom': {
      let from = isDateKey(custom?.from) ? custom!.from! : null;
      let to = isDateKey(custom?.to) ? custom!.to! : dateKey(now);
      if (from && from > to) [from, to] = [to, from];
      if (to > dateKey(now)) to = dateKey(now);
      if (from && from > to) from = to;
      return { start: from ? dateKeyToDate(from) : null, end: dateKeyToDate(to, true) };
    }
  }
}

export const inRange = (d: Date, range: DateRange) => (!range.start || d >= range.start) && d <= range.end;

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-IN', { timeZone: getAppTimezone(), ...opts });
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Chart buckets covering start..end: daily up to 14 days, weekly up to 92 days,
 * calendar months beyond (or always, with monthly: true). Edge buckets are clipped to the range.
 */
export function bucketsFor(start: Date, end: Date, { monthly = false } = {}): Bucket[] {
  if (end < start) return [];
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const s = zparts(start);
  const out: Bucket[] = [];

  if (!monthly && days <= 92) {
    const step = days <= 14 ? 1 : 7;
    for (let i = 0; ; i += step) {
      const bStart = zdate(s.year, s.month, s.day + i);
      if (bStart > end) break;
      const lastDay = zdate(s.year, s.month, s.day + i + step - 1, 23, 59, 59, 999);
      const bEnd = lastDay > end ? end : lastDay;
      const label = step === 1
        ? fmt(bStart, { day: 'numeric', month: 'short' })
        : fmt(bStart, { month: 'short' }) === fmt(bEnd, { month: 'short' })
          ? `${zparts(bStart).day}–${zparts(bEnd).day} ${fmt(bEnd, { month: 'short' })}`
          : `${fmt(bStart, { day: 'numeric', month: 'short' })} – ${fmt(bEnd, { day: 'numeric', month: 'short' })}`;
      out.push({ key: dateKey(bStart), label, start: bStart, end: bEnd });
    }
    return out;
  }

  for (let m = 0; ; m++) {
    const monthStart = zdate(s.year, s.month + m, 1);
    if (monthStart > end) break;
    const monthEnd = zdate(s.year, s.month + m + 1, 0, 23, 59, 59, 999);
    const z = zparts(monthStart);
    out.push({
      key: `${z.year}-${String(z.month + 1).padStart(2, '0')}`,
      label: fmt(monthStart, { month: 'short', year: 'numeric' }),
      start: monthStart < start ? start : monthStart,
      end: monthEnd > end ? end : monthEnd,
    });
  }
  return out;
}

/** Index of the bucket containing d, or -1. Buckets are sorted and contiguous. */
export function bucketIndex(buckets: Bucket[], d: Date): number {
  for (let i = 0; i < buckets.length; i++) if (d >= buckets[i].start && d <= buckets[i].end) return i;
  return -1;
}

/** Range start for charting: the chosen start, or the earliest record (else 6 months back) for "All". */
export function chartStart(range: DateRange, earliest: Date | null): Date {
  if (range.start) return range.start;
  if (earliest) return dateKeyToDate(dateKey(earliest));
  const p = zparts(range.end);
  return zdate(p.year, p.month - 5, 1);
}
