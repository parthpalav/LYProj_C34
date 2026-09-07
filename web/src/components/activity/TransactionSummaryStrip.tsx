import React from 'react';
import { formatCurrencyINR } from '../../utils/formatters';

export interface TransactionSummaryStripProps {
  count: number;
  totalSpend: number;
  needsTotal: number;
  wantsTotal: number;
  investmentsTotal: number;
  isFiltered: boolean;
}

export const TransactionSummaryStrip: React.FC<TransactionSummaryStripProps> = ({
  count,
  totalSpend,
  needsTotal,
  wantsTotal,
  investmentsTotal,
  isFiltered,
}) => {
  return (
    <div className="activity-summary-strip">
      <div className="summary-item">
        <span className="summary-label">
          {isFiltered ? 'Filtered Transactions' : 'Transactions'}
        </span>
        <span className="summary-value">{count}</span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Total Outflow</span>
        <span className="summary-value summary-negative">
          -{formatCurrencyINR(totalSpend)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Needs</span>
        <span className="summary-value text-need">
          {formatCurrencyINR(needsTotal)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Wants</span>
        <span className="summary-value text-want">
          {formatCurrencyINR(wantsTotal)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Investments</span>
        <span className="summary-value text-inv">
          {formatCurrencyINR(investmentsTotal)}
        </span>
      </div>
    </div>
  );
};
