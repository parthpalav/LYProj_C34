import React from 'react';
import type { FamilyCategoryBreakdown } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface HouseholdCategoryBreakdownProps {
  categories?: FamilyCategoryBreakdown[] | null;
}

export const HouseholdCategoryBreakdown: React.FC<HouseholdCategoryBreakdownProps> = ({
  categories,
}) => {
  const topCategories = categories ? categories.slice(0, 5) : [];

  return (
    <div className="household-category-card" role="region" aria-label="Top Household Spending Categories">
      <div className="family-section-header">
        <div>
          <h3 className="family-section-title">Top Household Categories</h3>
          <p className="family-section-subtitle">
            Leading combined spending areas across all family members.
          </p>
        </div>
      </div>

      {topCategories.length === 0 ? (
        <div className="household-zero-data">
          <p>No category spending recorded for this household period.</p>
        </div>
      ) : (
        <div className="household-category-list">
          {topCategories.map((cat, idx) => (
            <div key={cat.category || idx} className="household-category-row">
              <div className="household-category-rank">{idx + 1}</div>
              <div className="household-category-name-wrap">
                <span className="household-category-name">{cat.category}</span>
                <span className="household-category-pct-sub">
                  {cat.percentageOfOutflow}% of total household outflow
                </span>
              </div>
              <div className="household-category-amount">
                {formatCurrencyINR(cat.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
