import React from 'react';
import {
  Utensils,
  ShoppingBag,
  Car,
  Home,
  Zap,
  CreditCard,
  Film,
  HeartPulse,
  BookOpen,
  Sparkles,
  Shield,
  TrendingUp,
  Receipt,
  Edit3,
  Sliders,
  Trash2,
  AlertCircle,
} from 'lucide-react';
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
              + Add Transaction
            </Button>
          }
        />
      </div>
    );
  }

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'Food & Dining':
        return Utensils;
      case 'Groceries':
        return ShoppingBag;
      case 'Transport & Travel':
        return Car;
      case 'Housing':
        return Home;
      case 'Utilities & Bills':
        return Zap;
      case 'Debt & Loan Payments':
        return CreditCard;
      case 'Shopping':
        return ShoppingBag;
      case 'Entertainment':
        return Film;
      case 'Health':
        return HeartPulse;
      case 'Education':
        return BookOpen;
      case 'Personal Care':
        return Sparkles;
      case 'Insurance':
        return Shield;
      case 'Investments':
        return TrendingUp;
      default:
        return Receipt;
    }
  };

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
    const conf = typeof tx.confidenceScore === 'number' ? `${Math.round(tx.confidenceScore * 100)}%` : '';

    if (src === 'ml' || src === 'tfidf' || src === 'minilm') {
      return (
        <span className={`badge-source badge-source-ml ${tx.needsReview ? 'needs-review' : ''}`} title={`Machine Learning Classified ${conf}`}>
          <Sparkles size={11} aria-hidden="true" />
          <span>ML Suggested</span>
          {conf && <span className="source-conf">{conf}</span>}
        </span>
      );
    }
    if (src === 'manual') {
      return (
        <span className="badge-source badge-source-manual" title="User Specified">
          <Edit3 size={11} aria-hidden="true" />
          <span>Manual</span>
        </span>
      );
    }
    if (src === 'fallback') {
      return (
        <span className="badge-source badge-source-fallback" title="Rule-based classification">
          <Sliders size={11} aria-hidden="true" />
          <span>Rule-based</span>
        </span>
      );
    }
    return (
      <span className="badge-source badge-source-neutral">
        <span>{src}</span>
      </span>
    );
  };

  const startRecord = (page - 1) * 20 + 1;
  const endRecord = Math.min(page * 20, totalFilteredCount);

  return (
    <div className="activity-card-container" role="region" aria-label="Transactions Ledger">
      {/* Desktop Table View */}
      <div className="table-responsive-wrapper desktop-only-view">
        <table className="desktop-ledger-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '130px' }}>Date</th>
              <th scope="col">Description</th>
              <th scope="col" style={{ width: '170px' }}>Category</th>
              <th scope="col" style={{ width: '110px' }}>Type</th>
              <th scope="col" style={{ width: '140px' }}>Classification</th>
              <th scope="col" className="text-right" style={{ width: '130px' }}>Amount</th>
              <th scope="col" className="text-center" style={{ width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const dateObj = getTransactionDate(tx);
              const CategoryIcon = getCategoryIcon(tx.category);
              const isInvestment = tx.type === 'Investment';

              return (
                <tr key={tx.id} className="ledger-row">
                  <td className="ledger-date-cell">
                    <span className="date-main">{formatDateFull(dateObj)}</span>
                  </td>
                  <td className="ledger-desc-cell">
                    <div className="desc-content">
                      <div className="category-icon-box" aria-hidden="true">
                        <CategoryIcon size={15} />
                      </div>
                      <div className="desc-text-group">
                        <span className="desc-title">{tx.description || 'Untitled Transaction'}</span>
                        {tx.isAnomaly && (
                          <span className="anomaly-tag" title="Flagged as unusual activity compared to routine pattern">
                            <AlertCircle size={10} aria-hidden="true" />
                            <span>Unusual</span>
                          </span>
                        )}
                        {tx.needsReview && (
                          <span className="review-tag" title="Low confidence classification requiring confirmation">
                            <span>Review</span>
                          </span>
                        )}
                      </div>
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
                    <span className={`tabular-nums ${isInvestment ? 'tx-amount-investment' : 'amount-outflow'}`}>
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
                        aria-label={`Edit ${tx.description || 'transaction'}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="table-action-icon-btn text-danger"
                        onClick={() => onDelete(tx)}
                        title="Delete transaction"
                        aria-label={`Delete ${tx.description || 'transaction'}`}
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
        {transactions.map((tx) => {
          const dateObj = getTransactionDate(tx);
          const CategoryIcon = getCategoryIcon(tx.category);
          const isInvestment = tx.type === 'Investment';

          return (
            <div key={tx.id} className="ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-left">
                  <div className="category-icon-box" aria-hidden="true">
                    <CategoryIcon size={16} />
                  </div>
                  <div className="ledger-card-info">
                    <span className="ledger-card-desc">{tx.description || 'Untitled Transaction'}</span>
                    <span className="ledger-card-date">{formatDateFull(dateObj)}</span>
                  </div>
                </div>
                <span className={`tabular-nums ledger-card-amount ${isInvestment ? 'tx-amount-investment' : 'amount-outflow'}`}>
                  -{formatCurrencyINR(tx.amount)}
                </span>
              </div>

              <div className="ledger-card-body">
                <div className="ledger-card-tags">
                  <span className="category-tag">{tx.category}</span>
                  <span className={`type-tag ${getTypeBadgeClass(tx.type)}`}>
                    {tx.type || 'Need'}
                  </span>
                  {getSourceBadge(tx)}
                  {tx.isAnomaly && (
                    <span className="anomaly-tag" title="Flagged as unusual activity">
                      <AlertCircle size={10} aria-hidden="true" />
                      <span>Unusual</span>
                    </span>
                  )}
                  {tx.needsReview && (
                    <span className="review-tag" title="Review suggested">
                      <span>Review</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="ledger-card-footer">
                <button
                  type="button"
                  className="card-action-btn"
                  onClick={() => onEdit(tx)}
                  aria-label={`Edit ${tx.description || 'transaction'}`}
                >
                  <Edit3 size={13} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="card-action-btn card-action-danger"
                  onClick={() => onDelete(tx)}
                  aria-label={`Delete ${tx.description || 'transaction'}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="table-pagination">
          <span className="pagination-info tabular-nums">
            Showing {startRecord}–{endRecord} of {totalFilteredCount}
          </span>
          <div className="pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <span className="pagination-page-indicator tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
