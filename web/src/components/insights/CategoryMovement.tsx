import React from 'react';
import type { CategoryMovementItem } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface CategoryMovementProps {
  movements: CategoryMovementItem[];
  periodLabel: string;
}

export const CategoryMovement: React.FC<CategoryMovementProps> = ({
  movements,
  periodLabel,
}) => {
  if (movements.length === 0) {
    return (
      <div className="insights-card">
        <span className="overview-context-badge">EXPENDITURE SHIFTS</span>
        <h3 className="card-title">Category Movement</h3>
        <p className="card-subtitle">{periodLabel}</p>
        <p className="text-secondary text-sm" style={{ marginTop: '12px' }}>
          No significant category movements observed across comparable periods.
        </p>
      </div>
    );
  }

  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <span className="overview-context-badge">EXPENDITURE SHIFTS</span>
          <h3 className="card-title">Notable Category Movements</h3>
          <p className="card-subtitle">
            Top expenditure shifts ({periodLabel})
          </p>
        </div>
      </div>

      <div className="category-movement-list">
        {movements.map((item) => {
          const isUp = item.direction === 'up';

          return (
            <div key={item.category} className="movement-row-card">
              <div className="movement-left">
                <span className="movement-cat-name font-semibold text-primary">{item.category}</span>
                <div className="movement-flow text-xs text-secondary tabular-nums">
                  <span>{formatCurrencyINR(item.previousAmount)}</span>
                  <span className="flow-arrow" aria-hidden="true"> → </span>
                  <span className="font-semibold text-primary">{formatCurrencyINR(item.currentAmount)}</span>
                </div>
              </div>
              <div className="movement-right">
                <span className="movement-badge movement-badge-neutral tabular-nums">
                  {isUp ? `+${item.percentageChange}%` : `${item.percentageChange}%`}
                </span>
                <span className="movement-diff-text text-xs text-tertiary tabular-nums">
                  {isUp ? `+${formatCurrencyINR(item.difference)}` : formatCurrencyINR(item.difference)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
