export interface GoalProgress {
  /** fill fraction (0-1) before the contribution */
  from: number;
  /** fill fraction (0-1) after the contribution */
  to: number;
  newSaved: number;
  /** true only when this contribution crosses the target */
  completed: boolean;
}

const fraction = (saved: number, target: number) => (target > 0 ? Math.max(0, Math.min(1, saved / target)) : 0);

export function goalProgress(saved: number, add: number, target: number): GoalProgress {
  const newSaved = saved + add;
  return {
    from: fraction(saved, target),
    to: fraction(newSaved, target),
    newSaved,
    completed: target > 0 && saved < target && newSaved >= target,
  };
}

/** Highest of the 25 / 50 / 75 % milestones this contribution crosses, or null. 100 % is `completed`. */
export function milestoneCrossed(from: number, to: number): 0.25 | 0.5 | 0.75 | null {
  for (const m of [0.75, 0.5, 0.25] as const) if (from < m && to >= m && to < 1) return m;
  return null;
}

export interface GoalPlan {
  /** whole months left until the target date, at least 1; null when the date is missing or unreadable */
  months: number | null;
  remaining: number;
  /** what must go in each month to land on the target date */
  requiredMonthly: number | null;
  /** planned contribution minus required; negative means behind */
  gap: number | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** ISO dates, or the older free-text "December 2030" form. Hermes won't parse the latter itself. */
export function parseTargetDate(text: string | undefined): Date | null {
  if (!text) return null;
  const named = text.trim().match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i);
  if (named) {
    const m = MONTHS.indexOf(named[1].toLowerCase());
    return m >= 0 ? new Date(Number(named[2]), m, 1) : null;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Turns a goal's target date into a monthly plan. */
export function goalPlan(saved: number, target: number, targetDate: string | undefined, monthlyContribution: number, from: Date = new Date()): GoalPlan {
  const remaining = Math.max(0, target - saved);
  const when = parseTargetDate(targetDate);
  if (!when) return { months: null, remaining, requiredMonthly: null, gap: null };
  const months = Math.max(1, (when.getFullYear() - from.getFullYear()) * 12 + (when.getMonth() - from.getMonth()));
  const requiredMonthly = remaining / months;
  return { months, remaining, requiredMonthly, gap: monthlyContribution - requiredMonthly };
}
