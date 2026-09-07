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
    <div className="insights-type-cards-grid">
      {/* Needs Card */}
      <div className="type-analytic-card type-card-needs">
        <div className="type-card-header">
          <span className="type-indicator-dot dot-needs" />
          <span className="type-card-title">Needs</span>
          <span className="type-card-badge badge-type-need">{analysis.needs.percentage}%</span>
        </div>
        <div className="type-card-amount font-bold">
          {formatCurrencyINR(analysis.needs.amount)}
        </div>
        <div className="type-progress-track">
          <div
            className="type-progress-fill fill-needs"
            style={{ width: `${Math.min(analysis.needs.percentage, 100)}%` }}
          />
        </div>
        <div className="type-card-desc text-xs text-tertiary">
          Essential living obligations, groceries, rent & utilities
        </div>
      </div>

      {/* Wants Card */}
      <div className="type-analytic-card type-card-wants">
        <div className="type-card-header">
          <span className="type-indicator-dot dot-wants" />
          <span className="type-card-title">Wants</span>
          <span className="type-card-badge badge-type-want">{analysis.wants.percentage}%</span>
        </div>
        <div className="type-card-amount font-bold">
          {formatCurrencyINR(analysis.wants.amount)}
        </div>
        <div className="type-progress-track">
          <div
            className="type-progress-fill fill-wants"
            style={{ width: `${Math.min(analysis.wants.percentage, 100)}%` }}
          />
        </div>
        <div className="type-card-desc text-xs text-tertiary">
          Discretionary lifestyle, dining out, shopping & hobbies
        </div>
      </div>

      {/* Investments Card */}
      <div className="type-analytic-card type-card-investments">
        <div className="type-card-header">
          <span className="type-indicator-dot dot-investments" />
          <span className="type-card-title">Investments</span>
          <span className="type-card-badge badge-type-inv">{analysis.investments.percentage}%</span>
        </div>
        <div className="type-card-amount font-bold">
          {formatCurrencyINR(analysis.investments.amount)}
        </div>
        <div className="type-progress-track">
          <div
            className="type-progress-fill fill-investments"
            style={{ width: `${Math.min(analysis.investments.percentage, 100)}%` }}
          />
        </div>
        <div className="type-card-desc text-xs text-tertiary">
          Wealth-building assets, SIPs, mutual funds & savings
        </div>
      </div>
    </div>
  );
};
