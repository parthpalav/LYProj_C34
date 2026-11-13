import { useState } from 'react';
import { formatCurrencyINR } from './formatters';

/**
 * Click-to-inspect state for a chart. `index` is the highlighted point (null when closed);
 * `shown` keeps the last picked point so the panel's content doesn't blank while it collapses.
 */
export function useChartPick() {
  const [pick, setPick] = useState({ shown: 0, open: false });
  return {
    index: pick.open ? pick.shown : null,
    shown: pick.shown,
    open: pick.open,
    toggle: (i: number) => setPick((p) => ({ shown: i, open: !(p.open && p.shown === i) })),
    close: () => setPick((p) => ({ ...p, open: false })),
  };
}

/** onClick for a Recharts cartesian chart: picks the month or point under the cursor. */
export const pickFromChart = (toggle: (i: number) => void) => (state: { activeTooltipIndex?: number | string | null }) => {
  if (state.activeTooltipIndex == null) return;
  const i = Number(state.activeTooltipIndex);
  if (Number.isInteger(i)) toggle(i);
};

/** Dims every point except the picked one. */
export const pickOpacity = (picked: number | null, i: number) => (picked === null || picked === i ? 1 : 0.35);

/** "+₹1,200 (+8%)" against a previous value; null when there is nothing to compare with. */
export function changeFrom(current: number, previous: number | undefined): { text: string; up: boolean } | null {
  if (previous === undefined) return null;
  const diff = current - previous;
  const pct = previous !== 0 ? ` (${diff >= 0 ? '+' : ''}${Math.round((diff / Math.abs(previous)) * 100)}%)` : '';
  return { text: `${formatCurrencyINR(diff, { showSign: true })}${pct}`, up: diff >= 0 };
}
