import React from 'react';
import {
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Activity,
  CalendarX,
  ArrowDownRight,
} from 'lucide-react';
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
  const reliableTitle = stats.reliableIncomeLabel || `Reliable monthly income (${stats.percentileUsed}th percentile)`;

  return (
    <div className="insights-card" role="region" aria-label="Income Central Tendency & Volatility">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">How dependable is your income?</h3>
          <p className="card-subtitle">
            Compare your typical monthly earnings with a more cautious planning baseline.
          </p>
        </div>
      </div>

      <div className="income-explainer"><ShieldCheck size={18} aria-hidden="true" /><p><strong>What does the {stats.percentileUsed}th percentile mean?</strong> It is a cautious baseline: about {stats.percentileUsed}% of the observed monthly values fall at or below it. Add income history to make these comparisons useful.</p></div>
      <div className="income-stats-grid">
        {/* Mean Monthly Income */}
        <div className="income-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Mean Monthly Inflow</span>
            <div className="stat-card-icon-wrap icon-neutral">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold tabular-nums">
            {stats.meanMonthlyIncome !== null ? formatCurrencyINR(stats.meanMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc">
            Arithmetic average across all recorded months
          </span>
        </div>

        {/* Spike-Resistant Median Monthly Income */}
        <div className="income-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Median Monthly Inflow</span>
            <div className="stat-card-icon-wrap icon-neutral">
              <BarChart3 size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold tabular-nums">
            {stats.medianMonthlyIncome !== null ? formatCurrencyINR(stats.medianMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc">
            Spike-resistant central midpoint
          </span>
        </div>

        {/* Reliable Monthly Income */}
        <div className="income-stat-card highlight-card-emerald">
          <div className="stat-card-header">
            <span className="stat-card-label text-emerald">{reliableTitle}</span>
            <div className="stat-card-icon-wrap icon-emerald">
              <ShieldCheck size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold text-emerald tabular-nums">
            {stats.reliableMonthlyIncome !== null ? formatCurrencyINR(stats.reliableMonthlyIncome) : '—'}
          </div>
          <span className="stat-card-desc">
            Statistical conservative baseline at {stats.percentileUsed}th percentile
          </span>
        </div>

        {/* Income Volatility */}
        <div className="income-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Income Volatility</span>
            <div className="stat-card-icon-wrap icon-amber">
              <Activity size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold text-amber tabular-nums">
            {stats.volatilityPercentage !== null ? `${stats.volatilityPercentage}%` : '—'}
          </div>
          <span className="stat-card-desc">
            Coefficient of variation measuring inflow swing
          </span>
        </div>

        {/* Zero-Income Months */}
        <div className="income-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Zero-Income Months</span>
            <div className="stat-card-icon-wrap icon-neutral">
              <CalendarX size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold tabular-nums">
            {stats.zeroIncomeMonthsCount}
          </div>
          <span className="stat-card-desc">
            Months with ₹0 inflows in recorded history
          </span>
        </div>

        {/* Worst Rolling Quarter */}
        <div className="income-stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Lowest 3-Month Inflow Total</span>
            <div className="stat-card-icon-wrap icon-neutral">
              <ArrowDownRight size={15} />
            </div>
          </div>
          <div className="stat-card-val font-bold tabular-nums">
            {stats.worstRollingQuarterSum !== null ? formatCurrencyINR(stats.worstRollingQuarterSum) : '—'}
          </div>
          <span className="stat-card-desc">
            {stats.worstRollingQuarterMonths.length > 0
              ? `Historical lowest 3-month sum (${stats.worstRollingQuarterMonths.join(', ')})`
              : 'Historical lowest 3-consecutive-month inflow'}
          </span>
        </div>
      </div>
    </div>
  );
};
