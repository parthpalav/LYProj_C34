import React from 'react';
import { formatCurrencyINR } from '../../utils/formatters';

export interface SpendingTypeCardsProps {
  analysis: {
    needs: { amount: number; percentage: number };
    wants: { amount: number; percentage: number };
    investments: { amount: number; percentage: number };
    totalSpend: number;
  };
}

export const SpendingTypeCards: React.FC<SpendingTypeCardsProps> = ({ analysis }) => {
  return (
    <div className="insights-spending-hero-container">
      {/* Total Outflow Hero Card */}
      <div className="insights-hero-card spending-total-hero">
        <div className="hero-stat-label text-xs uppercase tracking-wider text-tertiary font-semibold">
          Total Period Outflow
        </div>
        <div className="hero-stat-value text-primary font-black tabular-nums">
          {formatCurrencyINR(analysis.totalSpend)}
        </div>
        <p className="hero-stat-caption text-xs text-secondary">
          Aggregated expenditure across all classifications in the selected timeframe
        </p>
      </div>

      {/* 3 Spending Dimensions Grid */}
      <div className="insights-type-cards-grid">
        {/* Needs Card */}
        <div className="type-analytic-card type-card-needs">
          <div className="type-card-header">
            <span className="type-indicator-dot dot-needs" aria-hidden="true" />
            <span className="type-card-title">Needs</span>
            <span className="badge-type badge-type-need">{analysis.needs.percentage}%</span>
          </div>
          <div className="type-card-amount font-bold text-primary tabular-nums">
            {formatCurrencyINR(analysis.needs.amount)}
          </div>
          <div className="type-progress-track" aria-hidden="true">
            <div
              className="type-progress-fill fill-needs"
              style={{ width: `${Math.min(analysis.needs.percentage, 100)}%` }}
            />
          </div>
          <div className="type-card-desc text-xs text-secondary">
            Essential living obligations, groceries, rent & utilities
          </div>
        </div>

        {/* Wants Card */}
        <div className="type-analytic-card type-card-wants">
          <div className="type-card-header">
            <span className="type-indicator-dot dot-wants" aria-hidden="true" />
            <span className="type-card-title">Wants</span>
            <span className="badge-type badge-type-want">{analysis.wants.percentage}%</span>
          </div>
          <div className="type-card-amount font-bold text-primary tabular-nums">
            {formatCurrencyINR(analysis.wants.amount)}
          </div>
          <div className="type-progress-track" aria-hidden="true">
            <div
              className="type-progress-fill fill-wants"
              style={{ width: `${Math.min(analysis.wants.percentage, 100)}%` }}
            />
          </div>
          <div className="type-card-desc text-xs text-secondary">
            Discretionary lifestyle, dining out, shopping & hobbies
          </div>
        </div>

        {/* Investments Card */}
        <div className="type-analytic-card type-card-investments">
          <div className="type-card-header">
            <span className="type-indicator-dot dot-investments" aria-hidden="true" />
            <span className="type-card-title">Investments</span>
            <span className="badge-type badge-type-investment">{analysis.investments.percentage}%</span>
          </div>
          <div className="type-card-amount font-bold text-primary tabular-nums">
            {formatCurrencyINR(analysis.investments.amount)}
          </div>
          <div className="type-progress-track" aria-hidden="true">
            <div
              className="type-progress-fill fill-investments"
              style={{ width: `${Math.min(analysis.investments.percentage, 100)}%` }}
            />
          </div>
          <div className="type-card-desc text-xs text-secondary">
            Wealth-building assets, SIPs, mutual funds & savings
          </div>
        </div>
      </div>
    </div>
  );
};
