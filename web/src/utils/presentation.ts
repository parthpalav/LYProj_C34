/** Backend percentiles use fractions; convert only at the display boundary. */
export function percentileForDisplay(fraction: number | null | undefined): number {
  return Math.round((fraction ?? 0.25) * 100);
}

export const FMI_NAME = 'Financial Maturity Index';

export function contributionStatus(required: number | null, gap: number | null) {
  if (required === null || gap === null || !Number.isFinite(required) || !Number.isFinite(gap)) return 'unavailable';
  return gap > 0 ? 'shortfall' : 'covered';
}
