import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrencyINR, formatDateFull, getTransactionDate } from '../../utils/formatters';

export interface AnomalousTransactionsListProps {
  transactions: Transaction[];
}

export const AnomalousTransactionsList: React.FC<AnomalousTransactionsListProps> = ({
  transactions,
}) => {
  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Anomalous Outflow Events</h3>
          <p className="card-subtitle">
            Transactions exceeding statistical norms (&gt; 1.8× personal baseline)
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-anomalies-note">
          <p className="text-secondary text-sm">
            No anomalous transactions detected in your recent transaction history.
          </p>
        </div>
      ) : (
        <div className="anomalies-list">
          {transactions.map((tx) => {
            const dateObj = getTransactionDate(tx);

            return (
              <div key={tx.id} className="anomaly-item-row">
                <div className="anomaly-item-left">
                  <span className="anomaly-item-desc font-semibold">{tx.description || 'Expense'}</span>
                  <div className="anomaly-item-meta text-xs text-secondary">
                    <span className="category-tag">{tx.category}</span>
                    <span className="meta-separator">•</span>
                    <span>{formatDateFull(dateObj)}</span>
                  </div>
                  <div className="anomaly-reason-tag text-xs text-amber font-medium">
                    ⚠️ Statistically unusual compared with recent baseline
                  </div>
                </div>
                <div className="anomaly-item-right">
                  <span className="anomaly-amount font-bold text-danger">
                    -{formatCurrencyINR(tx.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
