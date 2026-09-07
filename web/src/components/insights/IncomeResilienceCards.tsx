import React from 'react';

export interface IncomeResilienceCardsProps {
  resilience: {
    essentialCoverageRatio: number | null;
    isCoverageAdequate: boolean | null;
    bufferRunwayMonths: number | null;
  };
}

export const IncomeResilienceCards: React.FC<IncomeResilienceCardsProps> = ({ resilience }) => {
  const formatCoverage = (ratio: number | null) => {
    if (ratio === null || ratio === undefined) return '—';
    return `${Math.round(ratio * 100)}%`;
  };

  const formatRunway = (months: number | null) => {
    if (months === null || months === undefined) return '—';
    return `${months} months`;
  };

  return (
    <div className="insights-resilience-grid">
      {/* Essential Coverage Ratio */}
      <div className="resilience-card">
        <div className="resilience-card-top">
          <span className="resilience-title font-semibold">Essential Coverage Ratio</span>
          {resilience.isCoverageAdequate !== null && (
            <span
              className={`resilience-badge ${
                resilience.isCoverageAdequate ? 'resilience-badge-pass' : 'resilience-badge-warn'
              }`}
            >
              {resilience.isCoverageAdequate ? '✓ Adequate' : '⚠️ Low Buffer'}
            </span>
          )}
        </div>
        <div className="resilience-metric-val font-bold text-primary">
          {formatCoverage(resilience.essentialCoverageRatio)}
        </div>
        <p className="resilience-desc text-xs text-secondary">
          Portion of baseline essential monthly obligations covered by conservative reliable income.
        </p>
      </div>

      {/* Buffer Runway Months */}
      <div className="resilience-card">
        <div className="resilience-card-top">
          <span className="resilience-title font-semibold">Liquid Buffer Runway</span>
        </div>
        <div className="resilience-metric-val font-bold text-emerald">
          {formatRunway(resilience.bufferRunwayMonths)}
        </div>
        <p className="resilience-desc text-xs text-secondary">
          Estimated months of essential survival expenses supported by available liquid assets during zero-inflow periods.
        </p>
      </div>
    </div>
  );
};
