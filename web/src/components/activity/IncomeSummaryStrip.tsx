import React from 'react';
import { formatCurrencyINR } from '../../utils/formatters';

export interface IncomeSummaryStripProps {
  totalIncome: number;
  thisMonthIncome: number;
  averageIncome: number;
  incomeCount: number;
  volatility: number | null;
  dailySmoothed?: number;
}

export const IncomeSummaryStrip: React.FC<IncomeSummaryStripProps> = ({
  totalIncome,
  thisMonthIncome,
  averageIncome,
  incomeCount,
  volatility,
}) => {
  return (
    <div className="activity-summary-strip" role="region" aria-label="Income Summary">
      <div className="summary-item">
        <span className="summary-label">This Month</span>
        <span className="summary-value text-success tabular-nums">
          +{formatCurrencyINR(thisMonthIncome)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Total Recorded</span>
        <span className="summary-value tabular-nums">
          {formatCurrencyINR(totalIncome)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Average Entry</span>
        <span className="summary-value tabular-nums">
          {formatCurrencyINR(averageIncome)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Entries</span>
        <span className="summary-value tabular-nums">
          {incomeCount}
        </span>
      </div>

      {volatility !== null && (
        <>
          <div className="summary-divider" aria-hidden="true" />
          <div className="summary-item">
            <span className="summary-label">Income Volatility</span>
            <span className="summary-value tabular-nums">
              {volatility}%
            </span>
          </div>
        </>
      )}
    </div>
  );
};
