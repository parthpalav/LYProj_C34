import React from 'react';
import { Clock, Check, History, Edit3, Trash2 } from 'lucide-react';
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
              + Add Liability
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

  const getUrgencyClass = (dateStr?: string | null) => {
    if (!dateStr) return 'due-future';
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return 'due-future';
    const now = new Date();
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'due-past';
    if (diffDays <= 7) return 'due-soon';
    return 'due-future';
  };

  return (
    <div className="activity-card-container" role="region" aria-label="Recurring Liabilities Ledger">
      {/* Desktop Table */}
      <div className="table-responsive-wrapper desktop-only-view">
        <table className="desktop-ledger-table">
          <thead>
            <tr>
              <th scope="col">Obligation Name</th>
              <th scope="col" style={{ width: '130px' }}>Amount</th>
              <th scope="col" style={{ width: '110px' }}>Frequency</th>
              <th scope="col" style={{ width: '210px' }}>Next Due</th>
              <th scope="col" style={{ width: '120px' }}>Auto-Deduct</th>
              <th scope="col" style={{ width: '160px' }}>Category</th>
              <th scope="col" className="text-center" style={{ width: '110px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {liabilities.map((l) => {
              const hasDueDate = Boolean(l.nextDueDate);
              const urgencyClass = getUrgencyClass(l.nextDueDate);

              return (
                <tr key={l.id} className="ledger-row">
                  <td className="ledger-desc-cell">
                    <div className="desc-content">
                      <div className="category-icon-box liability-icon-box" aria-hidden="true">
                        <Clock size={15} />
                      </div>
                      <div className="desc-text-group">
                        <span className="desc-title font-semibold">{l.name}</span>
                        <span className="text-tertiary text-xs">{l.type || 'Need'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="ledger-amount-cell">
                    <span className="font-semibold text-primary tabular-nums">
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
                        <span className={`liability-urgency-badge ${urgencyClass}`}>
                          {formatRelativeDate(l.nextDueDate!)}
                        </span>
                        <span className="due-date-calendar">
                          {formatDateFull(l.nextDueDate!)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-tertiary text-sm">—</span>
                    )}
                  </td>
                  <td className="ledger-autodeduct-cell">
                    {l.autoDeduct ? (
                      <span className="badge-autodeduct-on" title="Automatic transaction recorded when schedule triggers">
                        <Check size={11} aria-hidden="true" /> Auto
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
                        aria-label={`Payment history for ${l.name}`}
                      >
                        <History size={14} />
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn"
                        onClick={() => onEdit(l)}
                        title="Edit liability"
                        aria-label={`Edit ${l.name}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(l)}
                        title="Remove liability"
                        aria-label={`Remove ${l.name}`}
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

      {/* Mobile Stacked Cards */}
      <div className="mobile-ledger-cards mobile-only-view">
        {liabilities.map((l) => {
          const urgencyClass = getUrgencyClass(l.nextDueDate);

          return (
            <div key={l.id} className="ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-left">
                  <div className="category-icon-box liability-icon-box" aria-hidden="true">
                    <Clock size={16} />
                  </div>
                  <div className="ledger-card-info">
                    <span className="ledger-card-desc">{l.name}</span>
                    <div className="ledger-card-due-row">
                      {l.nextDueDate ? (
                        <>
                          <span className={`liability-urgency-badge ${urgencyClass}`}>
                            {formatRelativeDate(l.nextDueDate)}
                          </span>
                          <span className="due-date-calendar">
                            {formatDateFull(l.nextDueDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-tertiary text-xs">No due date</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="ledger-card-amount text-primary font-semibold tabular-nums">
                  {formatCurrencyINR(l.amount)}
                </span>
              </div>
              <div className="ledger-card-body">
                <div className="ledger-card-tags">
                  <span className="frequency-badge">{formatFrequency(l.frequency)}</span>
                  <span className="category-tag">{l.category}</span>
                  {l.autoDeduct ? (
                    <span className="badge-autodeduct-on">
                      <Check size={11} aria-hidden="true" /> Auto
                    </span>
                  ) : (
                    <span className="badge-autodeduct-off">Manual</span>
                  )}
                </div>
              </div>
              <div className="ledger-card-footer">
                <button
                  type="button"
                  className="card-action-btn"
                  onClick={() => onViewHistory(l)}
                  aria-label={`History for ${l.name}`}
                >
                  <History size={13} aria-hidden="true" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  className="card-action-btn"
                  onClick={() => onEdit(l)}
                  aria-label={`Edit ${l.name}`}
                >
                  <Edit3 size={13} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="card-action-btn card-action-danger"
                  onClick={() => onDelete(l)}
                  aria-label={`Remove ${l.name}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
