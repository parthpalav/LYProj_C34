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
    <div className="activity-summary-strip" role="region" aria-label="Transaction summary">
      <div className="summary-item">
        <span className="summary-label">
          {isFiltered ? 'Filtered Records' : 'Transactions'}
        </span>
        <span className="summary-value tabular-nums">{count}</span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">
          {isFiltered ? 'Filtered Outflow' : 'Total Outflow'}
        </span>
        <span className="summary-value summary-negative tabular-nums">
          -{formatCurrencyINR(totalSpend)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Needs</span>
        <span className="summary-value text-need tabular-nums">
          {formatCurrencyINR(needsTotal)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Wants</span>
        <span className="summary-value text-want tabular-nums">
          {formatCurrencyINR(wantsTotal)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Investments</span>
        <span className="summary-value tx-amount-investment tabular-nums">
          {formatCurrencyINR(investmentsTotal)}
        </span>
      </div>
    </div>
  );
};
