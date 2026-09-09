import React from 'react';
import { Wallet, Edit3, Trash2 } from 'lucide-react';
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
              + Record Income
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="activity-card-container" role="region" aria-label="Income Streams Ledger">
      {/* Desktop Table View */}
      <div className="table-responsive-wrapper desktop-only-view">
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
                    <span className="date-main">{formatDateFull(d)}</span>
                  </td>
                  <td className="ledger-source-cell">
                    <span className="source-tag">
                      {inc.source || 'salary'}
                    </span>
                  </td>
                  <td className="ledger-desc-cell">
                    <div className="desc-content">
                      <div className="category-icon-box income-icon-box" aria-hidden="true">
                        <Wallet size={15} />
                      </div>
                      <span className="desc-title">{inc.description || 'Income received'}</span>
                    </div>
                  </td>
                  <td className="ledger-amount-cell text-right">
                    <span className="amount-inflow text-success tabular-nums">
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
                        aria-label={`Edit income ${inc.description || inc.source}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(inc)}
                        title="Delete income entry"
                        aria-label={`Delete income ${inc.description || inc.source}`}
                      >
                        <Trash2 size={14} />
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
      <div className="mobile-ledger-cards mobile-only-view">
        {incomes.map((inc) => {
          const d = new Date(inc.timestamp);
          return (
            <div key={inc.id} className="ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-left">
                  <div className="category-icon-box income-icon-box" aria-hidden="true">
                    <Wallet size={16} />
                  </div>
                  <div className="ledger-card-info">
                    <span className="ledger-card-desc">{inc.description || 'Income received'}</span>
                    <span className="ledger-card-date">{formatDateFull(d)}</span>
                  </div>
                </div>
                <span className="amount-inflow text-success tabular-nums ledger-card-amount">
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
                    aria-label={`Edit income ${inc.description || inc.source}`}
                  >
                    <Edit3 size={13} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="card-action-btn card-action-danger"
                    onClick={() => onDelete(inc)}
                    aria-label={`Delete income ${inc.description || inc.source}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    <span>Delete</span>
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
