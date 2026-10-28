export type Schedule = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | string;
  startDate?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  nextDueDate?: string | null;
};

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const onDay = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, daysIn(y, m)));

/** Next due date on or after `from`: the server's nextDueDate when present, else derived from the schedule. */
export function nextDue(s: Schedule, from: Date = new Date()): Date {
  const today = day(from);
  if (s.nextDueDate) {
    const server = day(new Date(s.nextDueDate));
    if (server >= today) return server;
  }
  const start = s.startDate ? day(new Date(s.startDate)) : today;
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
export function dueDatesWithin(s: Schedule, days: number, from: Date = new Date()): Date[] {
  const end = day(from);
  end.setDate(end.getDate() + days);
  const out: Date[] = [];
  let d = nextDue(s, from);
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
