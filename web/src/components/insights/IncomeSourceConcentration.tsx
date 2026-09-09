import React from 'react';
import type { IncomeSourceSummary } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface IncomeSourceConcentrationProps {
  sources: IncomeSourceSummary[];
}

export const IncomeSourceConcentration: React.FC<IncomeSourceConcentrationProps> = ({
  sources,
}) => {
  if (sources.length === 0) {
    return (
      <div className="insights-card" role="region" aria-label="Income Source Concentration">
        <h3 className="card-title">Income Source Concentration</h3>
        <p className="text-secondary text-sm" style={{ marginTop: '12px' }}>
          Record income events with categorized sources to observe income concentration.
        </p>
      </div>
    );
  }

  const maxAmount = sources[0]?.amount || 1;

  return (
    <div className="insights-card" role="region" aria-label="Income Source Concentration">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Income Source Concentration</h3>
          <p className="card-subtitle">
            Diversification profile across recorded income channels
          </p>
        </div>
        <span className="insights-header-badge">
          {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
        </span>
      </div>

      <div className="source-concentration-list">
        {sources.map((item, idx) => {
          const barWidth = Math.max(4, Math.round((item.amount / maxAmount) * 100));
          const rankFormatted = `#${String(idx + 1).padStart(2, '0')}`;

          return (
            <div key={item.source} className="source-rank-row">
              <div className="source-index tabular-nums">{rankFormatted}</div>
              <div className="source-info">
                <div className="source-title-row">
                  <span className="source-name font-semibold">{item.source}</span>
                  <span className="source-amount font-semibold tabular-nums">
                    {formatCurrencyINR(item.amount)}{' '}
                    <span className="text-tertiary text-xs font-normal">({item.percentage}%)</span>
                  </span>
                </div>
                <div className="source-bar-track">
                  <div
                    className="source-bar-fill"
                    style={{ width: `${barWidth}%` }}
                    title={`${item.source}: ${item.percentage}%`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
