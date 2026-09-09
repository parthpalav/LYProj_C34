import React from 'react';
import { Shield, Hourglass } from 'lucide-react';

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
    return `${ratio.toFixed(1)}×`;
  };

  const formatRunway = (months: number | null) => {
    if (months === null || months === undefined) return '—';
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  };

  return (
    <div className="insights-resilience-grid" role="region" aria-label="Income Resilience & Runway">
      {/* Essential Coverage Ratio */}
      <div className="resilience-card">
        <div className="resilience-card-top">
          <span className="resilience-title font-semibold">Essential Coverage Ratio</span>
          <div className="stat-card-icon-wrap icon-neutral">
            <Shield size={16} />
          </div>
        </div>
        <div className="resilience-metric-val font-bold text-primary tabular-nums">
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
          <div className="stat-card-icon-wrap icon-emerald">
            <Hourglass size={16} />
          </div>
        </div>
        <div className="resilience-metric-val font-bold text-emerald tabular-nums">
          {formatRunway(resilience.bufferRunwayMonths)}
        </div>
        <p className="resilience-desc text-xs text-secondary">
          Estimated months of essential survival expenses supported by available liquid assets during zero-inflow periods.
        </p>
      </div>
    </div>
  );
};
