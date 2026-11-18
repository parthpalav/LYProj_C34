export type Schedule = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | string;
  startDate?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  nextDueDate?: string | null;
};

const DEFAULT_TZ = 'Asia/Kolkata'; // same default as utils/timezone and the server
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Calendar day of `instant` in the account timezone, returned as a device-local
 * midnight Date. getDate()/getMonth() and toLocaleDateString() then show the
 * account's day on a device set to any timezone.
 */
export function accountDay(instant: Date | string | number, tz?: string | null): Date {
  const zone = tz || DEFAULT_TZ;
  let f = dayFormatters.get(zone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' });
    } catch {
      return accountDay(instant, DEFAULT_TZ); // unknown zone id
    }
    dayFormatters.set(zone, f);
  }
  const parts = f.formatToParts(new Date(instant));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(n('year'), n('month') - 1, n('day'));
}

const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const onDay = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, daysIn(y, m)));

/**
 * Next due date on or after `from`: the server's nextDueDate when present, else derived
 * from the schedule. Days are the account timezone's calendar days (`tz`), returned as
 * device-local midnights, so a traveller's phone shows the same due day as the account.
 */
export function nextDue(s: Schedule, from: Date = new Date(), tz?: string | null): Date {
  const today = accountDay(from, tz);
  if (s.nextDueDate) {
    const server = accountDay(s.nextDueDate, tz);
    if (server >= today) return server;
  }
  const start = s.startDate ? accountDay(s.startDate, tz) : today;
  const base = start > today ? start : today;
  switch (s.frequency) {
    case 'daily':
      return base;
    case 'weekly': {
      const dow = s.dayOfWeek ?? start.getDay();
      const d = new Date(base);
      d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
      return d;
    }
    case 'yearly': {
      const m = (s.monthOfYear ?? start.getMonth() + 1) - 1;
      const dm = s.dayOfMonth ?? start.getDate();
      const thisYear = onDay(base.getFullYear(), m, dm);
      return thisYear >= base ? thisYear : onDay(base.getFullYear() + 1, m, dm);
    }
    default: {
      const dm = s.dayOfMonth ?? start.getDate();
      const thisMonth = onDay(base.getFullYear(), base.getMonth(), dm);
      return thisMonth >= base ? thisMonth : onDay(base.getFullYear(), base.getMonth() + 1, dm);
    }
  }
}

/** Every due date in [from, from + days), stepping the schedule forward from nextDue. */
export function dueDatesWithin(s: Schedule, days: number, from: Date = new Date(), tz?: string | null): Date[] {
  const end = accountDay(from, tz);
  end.setDate(end.getDate() + days);
  const out: Date[] = [];
  let d = nextDue(s, from, tz);
  const dm = s.dayOfMonth ?? d.getDate();
  while (d < end && out.length < 62) {
    out.push(d);
    if (s.frequency === 'daily') d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    else if (s.frequency === 'weekly') d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    else if (s.frequency === 'yearly') d = onDay(d.getFullYear() + 1, d.getMonth(), dm);
    else d = onDay(d.getFullYear(), d.getMonth() + 1, dm);
  }
  return out;
}
