import React, { useState } from 'react';
import type { CategorySpendSummary } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface CategoryRankingProps {
  categories: CategorySpendSummary[];
}

export const CategoryRanking: React.FC<CategoryRankingProps> = ({ categories }) => {
  const [showAll, setShowAll] = useState(false);

  if (categories.length === 0) {
    return (
      <div className="insights-card">
        <h3 className="card-title">Category Breakdown</h3>
        <p className="text-secondary text-sm" style={{ marginTop: '12px' }}>
          No category spending recorded for the selected timeframe.
        </p>
      </div>
    );
  }

  const displayedCategories = showAll ? categories : categories.slice(0, 6);
  const maxAmount = categories[0]?.amount || 1;

  return (
    <div className="insights-card">
      <div className="card-header-flex">
        <div>
          <h3 className="card-title">Category Breakdown</h3>
          <p className="card-subtitle">Ranked by total expenditure in this period</p>
        </div>
        {categories.length > 6 && (
          <button
            type="button"
            className="card-text-action-btn"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Top 6' : `View All (${categories.length})`}
          </button>
        )}
      </div>

      <div className="category-ranking-list">
        {displayedCategories.map((item, index) => {
          const barWidth = Math.max(4, Math.round((item.amount / maxAmount) * 100));

          return (
            <div key={item.category} className="category-rank-row">
              <div className="rank-index text-tertiary text-xs">#{index + 1}</div>
              <div className="rank-info">
                <div className="rank-title-row">
                  <span className="rank-category-name font-semibold">{item.category}</span>
                  <span className="rank-category-amount font-semibold">
                    {formatCurrencyINR(item.amount)}{' '}
                    <span className="text-tertiary text-xs font-normal">({item.percentage}%)</span>
                  </span>
                </div>
                <div className="rank-bar-track">
                  <div
                    className="rank-bar-fill"
                    style={{ width: `${barWidth}%` }}
                    title={`${item.category}: ${item.percentage}%`}
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
