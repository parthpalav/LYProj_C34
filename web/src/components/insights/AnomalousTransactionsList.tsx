import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatCurrencyINR, formatDateFull, getTransactionDate } from '../../utils/formatters';

export interface AnomalousTransactionsListProps {
  transactions: Transaction[];
}

export const AnomalousTransactionsList: React.FC<AnomalousTransactionsListProps> = ({
  transactions,
}) => {
  return (
    <div className="insights-card" role="region" aria-label="Anomalous Outflow Events">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Anomalous Outflow Events</h3>
          <p className="card-subtitle">
            Transactions exceeding statistical norms (&gt; 1.8× personal baseline)
          </p>
        </div>
        <span className="insights-header-badge">
          {transactions.length} {transactions.length === 1 ? 'Event' : 'Events'} Flagged
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-anomalies-note">
          <AlertCircle size={20} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
          <p className="text-secondary text-sm">
            No anomalous transactions detected in your recent transaction history.
          </p>
        </div>
      ) : (
        <div className="anomalies-list">
          {transactions.map((tx) => {
            const dateObj = getTransactionDate(tx);
            const isInvestment = tx.type === 'Investment';

            return (
              <div key={tx.id} className="anomaly-item-row">
                <div className="anomaly-item-left">
                  <div className="anomaly-header-line">
                    <span className="anomaly-item-desc font-semibold">{tx.description || 'Expense'}</span>
                    {tx.type && (
                      <span className={`type-tag badge-type-${tx.type.toLowerCase()}`}>
                        {tx.type}
                      </span>
                    )}
                  </div>
                  <div className="anomaly-item-meta text-xs text-secondary">
                    <span className="category-tag">{tx.category}</span>
                    <span className="meta-separator">•</span>
                    <span>{formatDateFull(dateObj)}</span>
                  </div>
                  <div className="anomaly-reason-tag text-xs">
                    <AlertTriangle size={12} className="anomaly-warning-icon" />
                    <span>Statistically unusual compared with recent baseline</span>
                  </div>
                </div>
                <div className="anomaly-item-right">
                  <span className={`anomaly-amount tabular-nums font-semibold ${isInvestment ? 'tx-amount-investment' : 'amount-outflow'}`}>
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
