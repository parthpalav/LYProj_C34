/** Same list as server/utils/userTime.js; the server rejects anything else. */
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
