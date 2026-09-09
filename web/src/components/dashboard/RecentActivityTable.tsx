import React from 'react';
import { Link } from 'react-router-dom';
import { Receipt, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrencyINR, formatRelativeDate, getTransactionDate, formatDateShort } from '../../utils/formatters';
import { getLatestTransactions } from '../../services/dashboard';
import { EmptyState } from './EmptyState';

interface RecentActivityTableProps {
  transactions: Transaction[];
  limit?: number;
}

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  transactions,
  limit = 5,
}) => {
  const latest = getLatestTransactions(transactions, limit);

  if (latest.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        message="No transactions recorded yet."
        action={
          <Link to="/app/activity" className="empty-state-link">
            Record your first transaction →
          </Link>
        }
      />
    );
  }

  const getTypeBadgeClass = (type?: string) => {
    switch (type) {
      case 'Need':
        return 'tx-type-need';
      case 'Want':
        return 'tx-type-want';
      case 'Investment':
        return 'tx-type-inv';
      default:
        return 'tx-type-default';
    }
  };

  return (
    <div className="activity-panel">
      <div className="activity-list">
        {latest.map((tx) => {
          const txDate = getTransactionDate(tx);
          const isInvestment = tx.type === 'Investment';
          const isLiability = Boolean(tx.liabilityId);

          return (
            <div key={tx.id} className="tx-item">
              <div className="tx-item-left">
                <div
                  className={`tx-icon-wrap ${
                    isInvestment
                      ? 'tx-icon-investment'
                      : isLiability
                      ? 'tx-icon-liability'
                      : ''
                  }`}
                  aria-hidden="true"
                >
                  {isInvestment ? (
                    <TrendingUp size={16} />
                  ) : isLiability ? (
                    <Clock size={16} />
                  ) : (
                    <Receipt size={16} />
                  )}
                </div>
                <div className="tx-details">
                  <div className="tx-desc-row">
                    <span className="tx-desc">{tx.description || tx.category}</span>
                    {tx.isAnomaly && (
                      <span className="tx-anomaly-badge" title="Unusual transaction spike">
                        <AlertCircle size={11} aria-hidden="true" /> Anomaly
                      </span>
                    )}
                    {isLiability && (
                      <span className="tx-liability-badge" title="Recurring obligation auto-deducted">
                        Scheduled
                      </span>
                    )}
                  </div>
                  <div className="tx-meta-row">
                    <span className="tx-category">{tx.category}</span>
                    {tx.type && (
                      <>
                        <span className="tx-dot">·</span>
                        <span className={`tx-type-badge ${getTypeBadgeClass(tx.type)}`}>
                          {tx.type}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="tx-item-right">
                <span
                  className={`tx-amount tabular-nums ${
                    isInvestment ? 'tx-amount-investment' : 'tx-outflow'
                  }`}
                >
                  -{formatCurrencyINR(tx.amount)}
                </span>
                <span className="tx-date" title={formatDateShort(txDate)}>
                  {formatRelativeDate(txDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="activity-footer-link">
        <Link to="/app/activity" className="activity-view-all-link">
          View full ledger in Activity →
        </Link>
      </div>
    </div>
  );
};
