import React from 'react';
import type { IncomeRecord } from '../../types';
import { formatCurrencyINR, formatDateFull } from '../../utils/formatters';
import { EmptyState } from '../dashboard/EmptyState';
import { Button } from '../ui/Button';

export interface IncomeTableProps {
  incomes: IncomeRecord[];
  onEdit: (income: IncomeRecord) => void;
  onDelete: (income: IncomeRecord) => void;
  onAddClick: () => void;
}

export const IncomeTable: React.FC<IncomeTableProps> = ({
  incomes,
  onEdit,
  onDelete,
  onAddClick,
}) => {

  if (incomes.length === 0) {
    return (
      <div className="activity-card-container">
        <EmptyState
          title="No income entries recorded yet"
          message="Keep track of your salary, freelance earnings, investments, or gig work by adding your first income entry."
          action={
            <Button type="button" variant="primary" size="sm" onClick={onAddClick}>
              Add Income
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="activity-card-container">
      {/* Desktop Table View */}
      <div className="table-responsive-wrapper">
        <table className="desktop-ledger-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '140px' }}>Date</th>
              <th scope="col" style={{ width: '160px' }}>Source</th>
              <th scope="col">Description</th>
              <th scope="col" className="text-right" style={{ width: '150px' }}>Amount</th>
              <th scope="col" className="text-center" style={{ width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incomes.map((inc) => {
              const d = new Date(inc.timestamp);

              return (
                <tr key={inc.id} className="ledger-row">
                  <td className="ledger-date-cell">
                    {formatDateFull(d)}
                  </td>
                  <td className="ledger-source-cell">
                    <span className="source-tag">
                      {inc.source || 'salary'}
                    </span>
                  </td>
                  <td className="ledger-desc-cell">
                    <span className="desc-title">{inc.description || 'Income received'}</span>
                  </td>
                  <td className="ledger-amount-cell text-right">
                    <span className="amount-inflow">
                      +{formatCurrencyINR(inc.amount)}
                    </span>
                  </td>
                  <td className="ledger-actions-cell text-center">
                    <div className="table-inline-actions">
                      <button
                        type="button"
                        className="table-action-icon-btn"
                        onClick={() => onEdit(inc)}
                        title="Edit income entry"
                        aria-label="Edit income entry"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(inc)}
                        title="Delete income entry"
                        aria-label="Delete income entry"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="mobile-ledger-cards">
        {incomes.map((inc) => {
          const d = new Date(inc.timestamp);
          return (
            <div key={inc.id} className="ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-info">
                  <span className="ledger-card-desc">{inc.description || 'Income received'}</span>
                  <span className="ledger-card-date">{formatDateFull(d)}</span>
                </div>
                <span className="amount-inflow ledger-card-amount">
                  +{formatCurrencyINR(inc.amount)}
                </span>
              </div>
              <div className="ledger-card-footer">
                <span className="source-tag">{inc.source || 'salary'}</span>
                <div className="ledger-card-actions">
                  <button
                    type="button"
                    className="card-action-btn"
                    onClick={() => onEdit(inc)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="card-action-btn card-action-danger"
                    onClick={() => onDelete(inc)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
