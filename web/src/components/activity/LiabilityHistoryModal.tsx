import React, { useState, useEffect, useCallback } from 'react';
import type { Liability, Transaction } from '../../types';
import { getLiabilityTransactions } from '../../services/api';
import { formatCurrencyINR, formatDateFull } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface LiabilityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  liability: Liability | null;
}

export const LiabilityHistoryModal: React.FC<LiabilityHistoryModalProps> = ({
  isOpen,
  onClose,
  liability,
}) => {
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{
    totalPaid: number;
    paymentCount: number;
    lastPaymentAmount: number | null;
    lastPaymentDate: string | null;
  }>({ totalPaid: 0, paymentCount: 0, lastPaymentAmount: null, lastPaymentDate: null });
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (liabilityId: string, pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLiabilityTransactions(liabilityId, pageNum, 20);
      if (data) {
        setHistoryTransactions(data.transactions || []);
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error('Failed to load liability payment history:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to load payment history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (isOpen && liability) {
        if (mounted) {
          setPage(1);
          await fetchHistory(liability.id, 1);
        }
      } else if (mounted) {
        setHistoryTransactions([]);
        setSummary({ totalPaid: 0, paymentCount: 0, lastPaymentAmount: null, lastPaymentDate: null });
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isOpen, liability, fetchHistory]);

  const handlePageChange = (newPage: number) => {
    if (!liability) return;
    setPage(newPage);
    fetchHistory(liability.id, newPage);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={liability ? `Payment History: ${liability.name}` : 'Payment History'}
      subtitle="Track auto-deductions and recorded fulfillment transactions"
      maxWidth="680px"
    >
      <div className="liability-history-container">
        {/* Summary stats */}
        <div className="history-stats-grid">
          <div className="history-stat-card">
            <span className="history-stat-label">Total Paid to Date</span>
            <span className="history-stat-val text-primary font-bold">
              {formatCurrencyINR(summary.totalPaid)}
            </span>
          </div>
          <div className="history-stat-card">
            <span className="history-stat-label">Payments Executed</span>
            <span className="history-stat-val font-bold">
              {summary.paymentCount}
            </span>
          </div>
          <div className="history-stat-card">
            <span className="history-stat-label">Last Payment</span>
            <span className="history-stat-val">
              {summary.lastPaymentAmount
                ? `${formatCurrencyINR(summary.lastPaymentAmount)} on ${formatDateFull(summary.lastPaymentDate)}`
                : 'None yet'}
            </span>
          </div>
        </div>

        {error && (
          <div className="form-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="history-loading">
            <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%' }} />
            <span>Loading history...</span>
          </div>
        ) : historyTransactions.length === 0 ? (
          <div className="history-empty">
            <p>No payments recorded yet for this obligation.</p>
            {liability?.autoDeduct && (
              <p className="text-tertiary text-sm">
                Scheduled transactions will appear here once auto-deductions occur on the due date.
              </p>
            )}
          </div>
        ) : (
          <div className="history-table-wrapper">
            <table className="desktop-ledger-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {historyTransactions.map((tx) => (
                  <tr key={tx.id} className="ledger-row">
                    <td className="ledger-date-cell">{formatDateFull(tx.timestamp)}</td>
                    <td className="ledger-desc-cell">{tx.description || liability?.name}</td>
                    <td className="ledger-type-cell">
                      <span className="badge-source badge-source-ml">
                        {tx.classificationSource === 'manual' ? 'Manual Link' : 'Auto-Deduct'}
                      </span>
                    </td>
                    <td className="ledger-amount-cell text-right font-semibold">
                      -{formatCurrencyINR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
