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
