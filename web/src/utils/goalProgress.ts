// Same rules as client/src/utils/goalProgress.ts so web and mobile celebrate the same moments.
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

export const MILESTONE_COPY = { 0.25: 'A quarter of the way', 0.5: 'Halfway there', 0.75: 'Three quarters done' } as const;
