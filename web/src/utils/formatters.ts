import type { User } from '../types';

/**
 * Extracts 1-2 uppercase initials from a user's name or email.
 */
export function getUserInitials(user?: User | null): string {
  if (!user) return 'U';
  if (user.name && user.name.trim()) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email && user.email.trim()) {
    return user.email.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

/**
 * Extracts first name from a user object or email fallback.
 */
export function getUserFirstName(user?: User | null): string {
  if (!user) return 'User';
  if (user.name && user.name.trim()) {
    return user.name.trim().split(/\s+/)[0];
  }
  if (user.email && user.email.trim()) {
    return user.email.split('@')[0];
  }
  return 'User';
}

/**
 * Formats a number as Indian Rupee (INR) currency.
 * Follows Indian numbering system (lakhs, crores) with standard ₹ symbol.
 */
export function formatCurrencyINR(
  amount?: number | null,
  options?: {
    compact?: boolean;
    showSign?: boolean;
  }
): string {
  const val = Number(amount);
  if (isNaN(val) || !Number.isFinite(val)) {
    return '₹0';
  }

  const isNegative = val < 0;
  const absVal = Math.abs(val);

  if (options?.compact && absVal >= 100000) {
    if (absVal >= 10000000) {
      // Crores
      const cr = (absVal / 10000000).toFixed(1).replace(/\.0$/, '');
      const sign = isNegative ? '-' : options?.showSign ? '+' : '';
      return `${sign}₹${cr} Cr`;
    }
    // Lakhs
    const lk = (absVal / 100000).toFixed(1).replace(/\.0$/, '');
    const sign = isNegative ? '-' : options?.showSign ? '+' : '';
    return `${sign}₹${lk} L`;
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(absVal);

  const sign = isNegative ? '-' : options?.showSign && absVal > 0 ? '+' : '';
  return `${sign}₹${formatted}`;
}

/**
 * Safely resolves the transaction Date object from various possible backend fields:
 * timestamp | date | createdAt
 */
export function getTransactionDate(tx: { timestamp?: string | Date; date?: string | Date; createdAt?: string | Date }): Date {
  if (tx.timestamp) {
    const d = new Date(tx.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (tx.date) {
    const d = new Date(tx.date);
    if (!isNaN(d.getTime())) return d;
  }
  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Formats date into short format: e.g. "7 Sep" or "10 Sep"
 */
export function formatDateShort(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/**
 * Formats date with year: e.g. "10 Sep 2026"
 */
export function formatDateFull(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats month and year: e.g. "Sep 2026"
 */
export function formatMonthYear(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Returns human-friendly relative date string: "Today", "Yesterday", or "7 Sep"
 */
export function formatRelativeDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  if (targetDay === startOfToday) {
    return 'Today';
  }
  if (targetDay === startOfYesterday) {
    return 'Yesterday';
  }
  return formatDateShort(d);
}

