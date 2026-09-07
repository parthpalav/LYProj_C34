import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrencyINR, formatDateFull, getTransactionDate } from '../../utils/formatters';
import { EmptyState } from '../dashboard/EmptyState';
import { Button } from '../ui/Button';

export interface TransactionTableProps {
  transactions: Transaction[];
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onAddClick: () => void;
  totalFilteredCount: number;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onAddClick,
  totalFilteredCount,
}) => {

  if (totalFilteredCount === 0) {
    return (
      <div className="activity-card-container">
        <EmptyState
          title="No transactions found"
          message="No transactions match your current search or filter criteria. Try adjusting your filters or record a new transaction."
          action={
            <Button type="button" variant="primary" size="sm" onClick={onAddClick}>
              Add Transaction
            </Button>
          }
        />
      </div>
    );
  }

  const getTypeBadgeClass = (type?: string) => {
    switch (type) {
      case 'Need':
        return 'badge-type-need';
      case 'Want':
        return 'badge-type-want';
      case 'Investment':
        return 'badge-type-inv';
      default:
        return 'badge-type-neutral';
    }
  };

  const getSourceBadge = (tx: Transaction) => {
    const src = tx.classificationSource || tx.categorySource || 'manual';
    if (src === 'ml' || src === 'tfidf' || src === 'minilm') {
      const conf = tx.confidenceScore ? `${Math.round(tx.confidenceScore * 100)}%` : '';
      return (
        <span className="badge-source badge-source-ml" title={`ML Classified ${conf}`}>
          🤖 ML {conf}
        </span>
      );
    }
    if (src === 'manual') {
      return (
        <span className="badge-source badge-source-manual" title="User Specified">
          ✍️ Manual
        </span>
      );
    }
    if (src === 'fallback') {
      return (
        <span className="badge-source badge-source-fallback" title="Keyword Rule">
          ⚡ Rule
        </span>
      );
    }
    return (
      <span className="badge-source badge-source-neutral">
        {src}
      </span>
    );
  };

  return (
    <div className="activity-card-container">
      {/* Desktop Table View */}
      <div className="table-responsive-wrapper">
        <table className="desktop-ledger-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '130px' }}>Date</th>
              <th scope="col">Description</th>
              <th scope="col" style={{ width: '170px' }}>Category</th>
              <th scope="col" style={{ width: '110px' }}>Type</th>
              <th scope="col" style={{ width: '110px' }}>Source</th>
              <th scope="col" className="text-right" style={{ width: '130px' }}>Amount</th>
              <th scope="col" className="text-center" style={{ width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const dateObj = getTransactionDate(tx);

              return (
                <tr key={tx.id} className="ledger-row">
                  <td className="ledger-date-cell">
                    {formatDateFull(dateObj)}
                  </td>
                  <td className="ledger-desc-cell">
                    <div className="desc-content">
                      <span className="desc-title">{tx.description || 'Untitled Transaction'}</span>
                      {tx.isAnomaly && (
                        <span className="anomaly-tag" title="Anomaly flagged by system">
                          Anomaly
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="ledger-category-cell">
                    <span className="category-tag">{tx.category}</span>
                  </td>
                  <td className="ledger-type-cell">
                    <span className={`type-tag ${getTypeBadgeClass(tx.type)}`}>
                      {tx.type || 'Need'}
                    </span>
                  </td>
                  <td className="ledger-source-cell">
                    {getSourceBadge(tx)}
                  </td>
                  <td className="ledger-amount-cell text-right">
                    {/* Convention: Outflow always negative */}
                    <span className="amount-outflow">
                      -{formatCurrencyINR(tx.amount)}
                    </span>
                  </td>
                  <td className="ledger-actions-cell text-center">
                    <div className="table-inline-actions">
                      <button
                        type="button"
                        className="table-action-icon-btn"
                        onClick={() => onEdit(tx)}
                        title="Edit transaction"
                        aria-label="Edit transaction"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(tx)}
                        title="Delete transaction"
                        aria-label="Delete transaction"
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
        {transactions.map((tx) => {
          const dateObj = getTransactionDate(tx);
          return (
            <div key={tx.id} className="ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-info">
                  <span className="ledger-card-desc">{tx.description || 'Untitled Transaction'}</span>
                  <span className="ledger-card-date">{formatDateFull(dateObj)}</span>
                </div>
                <span className="amount-outflow ledger-card-amount">
                  -{formatCurrencyINR(tx.amount)}
                </span>
              </div>
              <div className="ledger-card-footer">
                <div className="ledger-card-tags">
                  <span className="category-tag">{tx.category}</span>
                  <span className={`type-tag ${getTypeBadgeClass(tx.type)}`}>
                    {tx.type || 'Need'}
                  </span>
                  {getSourceBadge(tx)}
                </div>
                <div className="ledger-card-actions">
                  <button
                    type="button"
                    className="card-action-btn"
                    onClick={() => onEdit(tx)}
                    aria-label="Edit"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="card-action-btn card-action-danger"
                    onClick={() => onDelete(tx)}
                    aria-label="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="table-pagination">
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <div className="pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
