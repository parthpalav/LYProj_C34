import React from 'react';
import type { MonthOverMonthDelta } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface MonthOverMonthComparisonProps {
  comparison: {
    periodLabel: string;
    currentMonthName: string;
    prevMonthName: string;
    total: MonthOverMonthDelta;
    needs: MonthOverMonthDelta;
    wants: MonthOverMonthDelta;
    investments: MonthOverMonthDelta;
  };
}

export const MonthOverMonthComparison: React.FC<MonthOverMonthComparisonProps> = ({ comparison }) => {
  const renderMetric = (label: string, delta: MonthOverMonthDelta) => {
    const isUp = delta.direction === 'up';
    const isDown = delta.direction === 'down';

    return (
      <div className="mom-metric-block">
        <div className="mom-metric-header">
          <span className="mom-metric-label font-medium text-secondary">{label}</span>
          <span className="mom-trend-pill mom-trend-neutral tabular-nums">
            {isUp && '↑ '}
            {isDown && '↓ '}
            {delta.percentageChange > 0 ? `+${delta.percentageChange}%` : `${delta.percentageChange}%`}
          </span>
        </div>
        <div className="mom-metric-values">
          <span className="mom-current-val font-bold text-primary tabular-nums">
            {formatCurrencyINR(delta.currentAmount)}
          </span>
          <span className="mom-prev-val text-xs text-tertiary tabular-nums">
            vs {formatCurrencyINR(delta.previousAmount)} prior
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <span className="overview-context-badge">FAIR PERIOD ANALYSIS</span>
          <h3 className="card-title">Comparable-Period Spend Comparison</h3>
          <p className="card-subtitle">{comparison.periodLabel}</p>
        </div>
      </div>

      <div className="mom-metrics-grid">
        {renderMetric('Total Spending', comparison.total)}
        {renderMetric('Need Spending', comparison.needs)}
        {renderMetric('Want Spending', comparison.wants)}
        {renderMetric('Investments', comparison.investments)}
      </div>
      <div className="mom-footer-note text-xs text-tertiary">
        * Evaluated over equivalent calendar days to prevent distortion from partial-month tracking.
      </div>
    </div>
  );
};
