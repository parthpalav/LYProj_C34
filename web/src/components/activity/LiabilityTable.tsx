import React from 'react';
import type { Liability } from '../../types';
import { formatCurrencyINR, formatDateFull, formatRelativeDate } from '../../utils/formatters';
import { EmptyState } from '../dashboard/EmptyState';
import { Button } from '../ui/Button';

export interface LiabilityTableProps {
  liabilities: Liability[];
  onEdit: (liability: Liability) => void;
  onDelete: (liability: Liability) => void;
  onViewHistory: (liability: Liability) => void;
  onAddClick: () => void;
}

export const LiabilityTable: React.FC<LiabilityTableProps> = ({
  liabilities,
  onEdit,
  onDelete,
  onViewHistory,
  onAddClick,
}) => {

  if (liabilities.length === 0) {
    return (
      <div className="activity-card-container">
        <EmptyState
          title="No recurring liabilities set up yet"
          message="Set up regular commitments like rent, EMIs, subscriptions, or utility bills to track upcoming dues."
          action={
            <Button type="button" variant="primary" size="sm" onClick={onAddClick}>
              Add Liability
            </Button>
          }
        />
      </div>
    );
  }

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
      default:
        return freq;
    }
  };

  return (
    <div className="activity-card-container">
      {/* Desktop Table */}
      <div className="table-responsive-wrapper">
        <table className="desktop-ledger-table">
          <thead>
            <tr>
              <th scope="col">Obligation Name</th>
              <th scope="col" style={{ width: '130px' }}>Amount</th>
              <th scope="col" style={{ width: '120px' }}>Frequency</th>
              <th scope="col" style={{ width: '170px' }}>Next Due</th>
              <th scope="col" style={{ width: '130px' }}>Auto-Deduct</th>
              <th scope="col" style={{ width: '150px' }}>Category</th>
              <th scope="col" className="text-center" style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {liabilities.map((l) => {
              const hasDueDate = Boolean(l.nextDueDate);

              return (
                <tr key={l.id} className="ledger-row">
                  <td className="ledger-desc-cell">
                    <div className="desc-content">
                      <span className="desc-title font-semibold">{l.name}</span>
                      <span className="text-tertiary text-xs">{l.type}</span>
                    </div>
                  </td>
                  <td className="ledger-amount-cell">
                    <span className="font-semibold text-primary">
                      {formatCurrencyINR(l.amount)}
                    </span>
                  </td>
                  <td className="ledger-freq-cell">
                    <span className="frequency-badge">
                      {formatFrequency(l.frequency)}
                    </span>
                  </td>
                  <td className="ledger-due-cell">
                    {hasDueDate ? (
                      <div className="due-date-info">
                        <span className="due-date-text">{formatDateFull(l.nextDueDate)}</span>
                        <span className="due-relative-text">{formatRelativeDate(l.nextDueDate)}</span>
                      </div>
                    ) : (
                      <span className="text-tertiary text-sm">—</span>
                    )}
                  </td>
                  <td className="ledger-autodeduct-cell">
                    {l.autoDeduct ? (
                      <span className="badge-autodeduct-on" title="Automatic transaction scheduled when due">
                        ⚡ Enabled
                      </span>
                    ) : (
                      <span className="badge-autodeduct-off" title="Manual payment tracking">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="ledger-category-cell">
                    <span className="category-tag">{l.category}</span>
                  </td>
                  <td className="ledger-actions-cell text-center">
                    <div className="table-inline-actions">
                      <button
                        type="button"
                        className="table-action-icon-btn"
                        onClick={() => onViewHistory(l)}
                        title="Payment history"
                        aria-label="Payment history"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn"
                        onClick={() => onEdit(l)}
                        title="Edit liability"
                        aria-label="Edit liability"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(l)}
                        title="Remove liability"
                        aria-label="Remove liability"
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

      {/* Mobile Stacked Cards */}
      <div className="mobile-ledger-cards">
        {liabilities.map((l) => (
          <div key={l.id} className="ledger-card">
            <div className="ledger-card-header">
              <div className="ledger-card-info">
                <span className="ledger-card-desc">{l.name}</span>
                <span className="ledger-card-date">
                  Next due: {l.nextDueDate ? formatDateFull(l.nextDueDate) : '—'}
                </span>
              </div>
              <span className="ledger-card-amount text-primary font-semibold">
                {formatCurrencyINR(l.amount)}
              </span>
            </div>
            <div className="ledger-card-footer">
              <div className="ledger-card-tags">
                <span className="frequency-badge">{formatFrequency(l.frequency)}</span>
                <span className="category-tag">{l.category}</span>
                {l.autoDeduct ? (
                  <span className="badge-autodeduct-on">⚡ Auto</span>
                ) : (
                  <span className="badge-autodeduct-off">Manual</span>
                )}
              </div>
              <div className="ledger-card-actions">
                <button
                  type="button"
                  className="card-action-btn"
                  onClick={() => onViewHistory(l)}
                >
                  History
                </button>
                <button
                  type="button"
                  className="card-action-btn"
                  onClick={() => onEdit(l)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="card-action-btn card-action-danger"
                  onClick={() => onDelete(l)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
