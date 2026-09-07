import React from 'react';
import { formatCurrencyINR } from '../../utils/formatters';

export interface IncomeMetricsGridProps {
  stats: {
    meanMonthlyIncome: number | null;
    medianMonthlyIncome: number | null;
    reliableMonthlyIncome: number | null;
    reliableIncomeLabel: string;
    percentileUsed: number;
    volatilityPercentage: number | null;
    zeroIncomeMonthsCount: number;
    worstRollingQuarterSum: number | null;
    worstRollingQuarterMonths: string[];
  };
}

export const IncomeMetricsGrid: React.FC<IncomeMetricsGridProps> = ({ stats }) => {
  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Income Central Tendency &amp; Volatility</h3>
          <p className="card-subtitle">
            Authoritative predictability metrics derived from your historical cash inflows
          </p>
        </div>
      </div>

      <div className="income-stats-grid">
        {/* Mean Monthly Income */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">Mean Monthly Inflow</span>
          <div className="stat-card-val font-bold text-primary">
            {stats.meanMonthlyIncome !== null ? formatCurrencyINR(stats.meanMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            Arithmetic average across all recorded months
          </span>
        </div>

        {/* Spike-Resistant Median Monthly Income */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">Median Monthly Inflow</span>
          <div className="stat-card-val font-bold text-primary">
            {stats.medianMonthlyIncome !== null ? formatCurrencyINR(stats.medianMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            Spike-resistant central midpoint
          </span>
        </div>

        {/* Reliable Monthly Income (Explicit percentile context per Correction #5) */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">
            {stats.reliableIncomeLabel}
          </span>
          <div className="stat-card-val font-bold text-emerald">
            {stats.reliableMonthlyIncome !== null ? formatCurrencyINR(stats.reliableMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            Statistical conservative baseline at {stats.percentileUsed}th percentile
          </span>
        </div>

        {/* Income Volatility */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">Income Volatility</span>
          <div className="stat-card-val font-bold text-amber">
            {stats.volatilityPercentage !== null ? `${stats.volatilityPercentage}%` : '—'}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            Coefficient of variation measuring inflow swing
          </span>
        </div>

        {/* Zero-Income Months */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">Zero-Income Months</span>
          <div className="stat-card-val font-bold text-primary">
            {stats.zeroIncomeMonthsCount}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            Months with ₹0 inflows in recorded history
          </span>
        </div>

        {/* Worst Rolling Quarter */}
        <div className="income-stat-card">
          <span className="stat-card-label text-xs text-tertiary">Worst Rolling Quarter</span>
          <div className="stat-card-val font-bold text-primary">
            {stats.worstRollingQuarterSum !== null ? formatCurrencyINR(stats.worstRollingQuarterSum) : '—'}
          </div>
          <span className="stat-card-desc text-xs text-secondary">
            {stats.worstRollingQuarterMonths.length > 0
              ? `Lowest 3-month sum (${stats.worstRollingQuarterMonths.join(', ')})`
              : 'Lowest 3-consecutive-month inflow'}
          </span>
        </div>
      </div>
    </div>
  );
};
