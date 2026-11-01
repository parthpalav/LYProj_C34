// User timezone helpers.
//
// Calendar logic in this codebase uses getUTC*/Date.UTC. To run that logic in a
// user's timezone we "zone" an instant: shift it so its UTC fields read as the
// wall clock in that timezone, run the UTC logic, then "unzone" any resulting
// calendar instant back to a real instant.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Short list offered in the profile picker (IANA ids).
export const SUPPORTED_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC'
];

export function resolveTimezone(tz) {
  return SUPPORTED_TIMEZONES.includes(tz) ? tz : DEFAULT_TIMEZONE;
}

const formatters = new Map();
function partsFormatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }
  return formatters.get(tz);
}

// Milliseconds the timezone is ahead of UTC at `date`.
export function tzOffsetMs(date, tz) {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant -> Date whose getUTC* fields are the wall clock in `tz`. */
export function toZoned(date, tz = DEFAULT_TIMEZONE) {
  const d = new Date(date);
  return new Date(d.getTime() + tzOffsetMs(d, resolveTimezone(tz)));
}

/** Inverse of toZoned: wall-clock Date (UTC fields) in `tz` -> real instant. */
export function fromZoned(zoned, tz = DEFAULT_TIMEZONE) {
  const zone = resolveTimezone(tz);
  const guess = new Date(zoned.getTime() - tzOffsetMs(zoned, zone));
  // Second pass corrects for a DST change between the guess and the target.
  return new Date(zoned.getTime() - tzOffsetMs(guess, zone));
}

/** "YYYY-MM-DD" of `date` in `tz`. */
export function zonedDateKey(date, tz = DEFAULT_TIMEZONE) {
  return toZoned(date, tz).toISOString().slice(0, 10);
}

/** Hour of day (0-23) of `date` in `tz`. */
export function zonedHour(date, tz = DEFAULT_TIMEZONE) {
  return toZoned(date, tz).getUTCHours();
}

/** Start of the month containing `date` in `tz`, offset by `addMonths`, as a real instant. */
export function zonedMonthStart(date, tz = DEFAULT_TIMEZONE, addMonths = 0) {
  const z = toZoned(date, tz);
  return fromZoned(new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth() + addMonths, 1)), tz);
}

/** Start of the day containing `date` in `tz`, offset by `addDays`, as a real instant. */
export function zonedDayStart(date, tz = DEFAULT_TIMEZONE, addDays = 0) {
  const z = toZoned(date, tz);
  return fromZoned(new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate() + addDays)), tz);
}
