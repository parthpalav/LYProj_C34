// App-wide timezone. Every date shown or grouped (by day, week, month) uses the
// user's chosen timezone rather than the browser's. AuthContext keeps it in sync
// with user.timezone. The list matches server/utils/userTime.js.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const TIMEZONE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { id: 'Asia/Kathmandu', label: 'Nepal (UTC+5:45)' },
  { id: 'Asia/Dhaka', label: 'Bangladesh (UTC+6)' },
  { id: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
  { id: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { id: 'Asia/Tokyo', label: 'Japan (JST, UTC+9)' },
  { id: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { id: 'Pacific/Auckland', label: 'New Zealand (NZST/NZDT)' },
  { id: 'Africa/Johannesburg', label: 'South Africa (SAST, UTC+2)' },
  { id: 'Europe/London', label: 'London (GMT/BST)' },
  { id: 'Europe/Berlin', label: 'Central Europe (CET/CEST)' },
  { id: 'America/New_York', label: 'US Eastern (ET)' },
  { id: 'America/Chicago', label: 'US Central (CT)' },
  { id: 'America/Denver', label: 'US Mountain (MT)' },
  { id: 'America/Los_Angeles', label: 'US Pacific (PT)' },
  { id: 'UTC', label: 'UTC' },
];

let appTimezone = DEFAULT_TIMEZONE;

export function setAppTimezone(tz?: string | null): void {
  appTimezone = TIMEZONE_OPTIONS.some((o) => o.id === tz) ? (tz as string) : DEFAULT_TIMEZONE;
}

export function getAppTimezone(): string {
  return appTimezone;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface ZonedParts {
  year: number;
  /** 0-11, like Date.getMonth() */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 0 (Sunday) - 6, like Date.getDay() */
  weekday: number;
}

/** Wall-clock fields of an instant in the app timezone (replaces getFullYear/getMonth/...). */
export function zparts(date: Date | string | number = new Date(), tz = appTimezone): ZonedParts {
  const p: Record<string, string> = {};
  for (const x of partsFormatter(tz).formatToParts(new Date(date))) p[x.type] = x.value;
  return {
    year: +p.year, month: +p.month - 1, day: +p.day,
    hours: +p.hour, minutes: +p.minute, seconds: +p.second,
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

function offsetMs(date: Date, tz: string): number {
  const z = zparts(date, tz);
  const asUtc = Date.UTC(z.year, z.month, z.day, z.hours, z.minutes, z.seconds);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant for a wall-clock time in the app timezone. Same arguments and
 * overflow rules as `new Date(year, month, day, ...)`, which it replaces.
 */
export function zdate(year: number, month: number, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0, tz = appTimezone): Date {
  const wall = Date.UTC(year, month, day, hours, minutes, seconds, ms);
  const guess = new Date(wall - offsetMs(new Date(wall), tz));
  return new Date(wall - offsetMs(guess, tz)); // second pass handles DST edges
}

/** Number of days in a month (month 0-11; overflow allowed). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** "YYYY-MM-DD" of an instant in the app timezone. */
export function dateKey(date: Date | string | number = new Date(), tz = appTimezone): string {
  const z = zparts(date, tz);
  return `${z.year}-${String(z.month + 1).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
}

/** Today's "YYYY-MM-DD" in the app timezone (for date inputs). */
export function todayKey(): string {
  return dateKey(new Date());
}

/** Instant at the start (or end) of a "YYYY-MM-DD" day in the app timezone. */
export function dateKeyToDate(key: string, endOfDay = false): Date {
  const [y, m, d] = key.split('-').map(Number);
  return endOfDay ? zdate(y, m - 1, d, 23, 59, 59, 999) : zdate(y, m - 1, d);
}

/** Start of the day containing `date` in the app timezone, shifted by `addDays`. */
export function startOfDay(date: Date | string | number = new Date(), addDays = 0): Date {
  const z = zparts(date);
  return zdate(z.year, z.month, z.day + addDays);
}

/**
 * ISO timestamp for an expense/income date picked in a date input. Today keeps the
 * current time. Past dates use noon, so late-night spending checks don't flag a
 * date-only entry and DST edges can't push it onto another day.
 */
export function dateInputToISO(key: string): string {
  if (!key || key === todayKey()) return new Date().toISOString();
  const [y, m, d] = key.split('-').map(Number);
  return zdate(y, m - 1, d, 12).toISOString();
}
