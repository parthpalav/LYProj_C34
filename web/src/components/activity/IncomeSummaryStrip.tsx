import React from 'react';
import { formatCurrencyINR } from '../../utils/formatters';

export interface IncomeSummaryStripProps {
  totalIncome: number;
  thisMonthIncome: number;
  averageIncome: number;
  incomeCount: number;
  volatility: number | null;
  dailySmoothed: number;
}

export const IncomeSummaryStrip: React.FC<IncomeSummaryStripProps> = ({
  totalIncome,
  thisMonthIncome,
  averageIncome,
  incomeCount,
  volatility,
  dailySmoothed,
}) => {
  return (
    <div className="activity-summary-strip">
      <div className="summary-item">
        <span className="summary-label">This Month</span>
        <span className="summary-value text-success">
          +{formatCurrencyINR(thisMonthIncome)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Total Recorded</span>
        <span className="summary-value">
          {formatCurrencyINR(totalIncome)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Average Entry</span>
        <span className="summary-value">
          {formatCurrencyINR(averageIncome)}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Entries</span>
        <span className="summary-value">
          {incomeCount}
        </span>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <span className="summary-label">Daily Smoothed</span>
        <span className="summary-value">
          {formatCurrencyINR(dailySmoothed)}/day
        </span>
      </div>

      {volatility !== null && (
        <>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Income Volatility</span>
            <span className="summary-value">
              {volatility}%
            </span>
          </div>
        </>
      )}
    </div>
  );
};
