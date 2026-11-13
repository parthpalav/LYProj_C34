import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions';
import { useIncome } from '../hooks/useIncome';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { transactionPaymentLabel } from '../utils/paymentMethods';
import type { Transaction, IncomeRecord, TransactionPayload, IncomePayload } from '../types';
import { formatCurrencyINR, getTransactionDate } from '../utils/formatters';
import { dateKey } from '../utils/timezone';
import { getPacingReport } from '../services/api';
import { ActivityNudges } from '../components/activity/ActivityNudges';

import { ActivityTabs, type ActivityTabKey } from '../components/activity/ActivityTabs';
import { TransactionSummaryStrip } from '../components/activity/TransactionSummaryStrip';
import { TransactionFilterToolbar } from '../components/activity/TransactionFilterToolbar';
import { TransactionTable } from '../components/activity/TransactionTable';
import { TransactionModal } from '../components/activity/TransactionModal';

import { IncomeSummaryStrip } from '../components/activity/IncomeSummaryStrip';
import { IncomeTable } from '../components/activity/IncomeTable';
import { IncomeModal } from '../components/activity/IncomeModal';


import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { SectionError } from '../components/dashboard/SectionError';
import { Plus } from 'lucide-react';
import { celebrate } from '../utils/celebrate';

export const ActivityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State preserved in URL (?tab=transactions | income)
  const tabParam = searchParams.get('tab');
  const activeTab: ActivityTabKey = tabParam === 'income' ? 'income' : 'transactions';

  const handleTabChange = (newTab: ActivityTabKey) => {
    setSearchParams({ tab: newTab });
  };

  // Domain Hooks
  const txState = useTransactions();
  // History is kept in full; the custom range can reach back to the first transaction
  const earliestTxKey = React.useMemo(() => {
    let min = Infinity;
    for (const tx of txState.transactions) {
      const t = getTransactionDate(tx).getTime();
      if (t < min) min = t;
    }
    return Number.isFinite(min) ? dateKey(new Date(min)) : null;
  }, [txState.transactions]);
  const incState = useIncome();
  const payState = usePaymentMethods();

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' | 'info' | 'warning' }>({
    message: null,
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => {
        setToast({ message: null, type: 'success' });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Transaction modals & actions state
  const [isTxModalOpen, setIsTxModalOpen] = useState(searchParams.get('entry') === 'new');
  // The top-bar palette can ask for a new entry while this page is already open.
  useEffect(() => {
    if (searchParams.get('entry') === 'new') setIsTxModalOpen(true);
  }, [searchParams]);
  const closeTransaction = () => {
    setIsTxModalOpen(false);
    if (searchParams.has('entry')) {
      setSearchParams((previous) => { const next = new URLSearchParams(previous); next.delete('entry'); return next; }, { replace: true });
    }
  };
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Income modals & actions state
  const [isIncModalOpen, setIsIncModalOpen] = useState(false);
  const [editingInc, setEditingInc] = useState<IncomeRecord | null>(null);
  const [deletingInc, setDeletingInc] = useState<IncomeRecord | null>(null);
  const [isDeletingInc, setIsDeletingInc] = useState(false);

  const isCardTx = (tx: Transaction | null) =>
    Boolean(tx?.paymentMethodId && payState.methods.find((m) => m.id === tx.paymentMethodId)?.kind === 'credit_card');

  // ── Transaction Action Handlers ───────────────────────────────────────────

  const handleOpenAddTx = () => {
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  const handleSaveTx = async (payload: TransactionPayload) => {
    if (editingTx) {
      await txState.edit(editingTx.id, payload);
      payState.refetch();
      showToast('Transaction updated successfully.');
    } else {
      await txState.add(payload);
      payState.refetch();
      if (payload.type === 'Investment') {
        celebrate({ kind: 'fireworks', title: `${formatCurrencyINR(payload.amount)} invested`, subtitle: 'Your future self says thanks. Investments this month just went up.' });
      } else {
        showToast('Transaction added to ledger.');
      }
      // Budget nudge (mobile parity): warn after the success toast when Needs/Wants pass the monthly limit.
      const bucket = payload.type === 'Need' ? 'Needs' : payload.type === 'Want' ? 'Wants' : null;
      if (bucket) {
        getPacingReport()
          .then((p) => {
            const b = p?.[bucket];
            if (b && b.limit > 0 && b.actual > b.limit) {
              setTimeout(() => showToast(`${bucket} over budget: ${formatCurrencyINR(b.actual)} spent of ${formatCurrencyINR(b.limit)} this month.`, 'warning'), 2200);
            }
          })
          .catch(() => {});
      }
    }
  };

  const handleConfirmDeleteTx = async () => {
    if (!deletingTx) return;
    setIsDeletingTx(true);
    try {
      await txState.remove(deletingTx.id);
      payState.refetch();
      const refundedTo = isCardTx(deletingTx) ? transactionPaymentLabel(deletingTx.paymentMethodId, payState.methods) : 'balance';
      showToast(`Transaction deleted. ₹${deletingTx.amount} refunded to ${refundedTo}.`);
      setDeletingTx(null);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete transaction.', 'error');
    } finally {
      setIsDeletingTx(false);
    }
  };

  // ── Income Action Handlers ────────────────────────────────────────────────

  const handleOpenAddInc = () => {
    setEditingInc(null);
    setIsIncModalOpen(true);
  };

  const handleOpenEditInc = (inc: IncomeRecord) => {
    setEditingInc(inc);
    setIsIncModalOpen(true);
  };

  const handleSaveInc = async (payload: IncomePayload) => {
    if (editingInc) {
      await incState.edit(editingInc.id, payload);
      showToast('Income entry updated successfully.');
    } else {
      await incState.add(payload);
      const src = payload.source || 'salary';
      celebrate({ kind: 'coins', title: `${formatCurrencyINR(payload.amount)} income added`, subtitle: `Logged as ${src.charAt(0).toUpperCase()}${src.slice(1)}. Balance credited.` });
    }
  };

  const handleConfirmDeleteInc = async () => {
    if (!deletingInc) return;
    setIsDeletingInc(true);
    try {
      await incState.remove(deletingInc.id);
      showToast(`Income entry removed. Balance adjusted.`);
      setDeletingInc(null);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete income.', 'error');
    } finally {
      setIsDeletingInc(false);
    }
  };

  const isTxFiltered =
    Boolean(txState.searchQuery.trim()) ||
    txState.categoryFilter !== 'ALL' ||
    txState.typeFilter !== 'ALL' ||
    txState.dateFilter !== 'all' ||
    Boolean(txState.customStartDate) ||
    Boolean(txState.customEndDate);

  // Liabilities moved to the Net worth page; keep old links working.
  if (tabParam === 'liabilities') return <Navigate to="/app/net-worth?tab=liabilities" replace />;

  return (
    <div className="activity-page animate-fade-in">
      {/* Toast Notification Container */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: null, type: 'success' })}
      />

      {/* Header Section */}
      <header className="overview-header overview-section-hero">
        <div className="overview-header-left">
          <span className="overview-context-badge">MONEY & CASH FLOW</span>
          <h1 className="overview-title">Activity</h1>
          <p className="overview-subtitle">
            Inspect, record, and maintain your transactions and income streams
          </p>
        </div>

        <div className="overview-header-right">
          {activeTab === 'transactions' && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenAddTx}
              leftIcon={<Plus size={16} strokeWidth={2.5} />}
            >
              Add Transaction
            </Button>
          )}
          {activeTab === 'income' && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenAddInc}
              leftIcon={<Plus size={16} strokeWidth={2.5} />}
            >
              Record Income
            </Button>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <ActivityTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={{
          transactions: txState.transactions.length,
          income: incState.incomes.length,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: TRANSACTIONS                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="activity-tab-content">
          {txState.error && (
            <SectionError message={txState.error} onRetry={txState.refetch} />
          )}

          {txState.isLoading ? (
            <SkeletonCard height={280} />
          ) : (
            <>
              <ActivityNudges transactions={txState.transactions} notify={showToast} />

              {/* Filter Toolbar */}
              <TransactionFilterToolbar
                searchQuery={txState.searchQuery}
                onSearchChange={txState.setSearchQuery}
                categoryFilter={txState.categoryFilter}
                onCategoryChange={txState.setCategoryFilter}
                typeFilter={txState.typeFilter}
                onTypeChange={txState.setTypeFilter}
                dateFilter={txState.dateFilter}
                onDateFilterChange={txState.setDateFilter}
                customStartDate={txState.customStartDate}
                onCustomStartDateChange={txState.setCustomStartDate}
                customEndDate={txState.customEndDate}
                onCustomEndDateChange={txState.setCustomEndDate}
                sortBy={txState.sortBy}
                onSortChange={txState.setSortBy}
                onResetFilters={txState.resetFilters}
                onAddClick={handleOpenAddTx}
                isFiltered={isTxFiltered}
                minDate={earliestTxKey}
              />

              {/* Filter Summary Strip: month headers carry the totals until a filter is on */}
              {isTxFiltered && <TransactionSummaryStrip
                count={txState.summary.count}
                totalSpend={txState.summary.totalSpend}
                needsTotal={txState.summary.needsTotal}
                wantsTotal={txState.summary.wantsTotal}
                investmentsTotal={txState.summary.investmentsTotal}
                isFiltered={isTxFiltered}
              />}

              {/* Transactions Ledger Table / Cards */}
              <TransactionTable
                transactions={txState.paginatedTransactions}
                allTransactions={txState.filteredTransactions}
                groupByMonth={txState.sortBy === 'newest' || txState.sortBy === 'oldest'}
                paymentMethods={payState.methods}
                hasMore={txState.hasMore}
                onShowMore={txState.showMore}
                onEdit={handleOpenEditTx}
                onDelete={(tx) => setDeletingTx(tx)}
                onAddClick={handleOpenAddTx}
                totalFilteredCount={txState.filteredTransactions.length}
                hasRecordedTransactions={txState.transactions.length > 0}
                onClearFilters={txState.resetFilters}
              />
            </>
          )}

          {/* Add / Edit Transaction Modal */}
          <TransactionModal
            isOpen={isTxModalOpen}
            onClose={closeTransaction}
            onSubmit={handleSaveTx}
            initialTransaction={editingTx}
            paymentMethods={payState.methods}
          />

          {/* Delete Transaction Confirmation Dialog */}
          <ConfirmDialog
            isOpen={Boolean(deletingTx)}
            onClose={() => setDeletingTx(null)}
            onConfirm={handleConfirmDeleteTx}
            title="Delete Transaction?"
            message={`Are you sure you want to delete "${deletingTx?.description || 'this transaction'}"?`}
            warningNote={isCardTx(deletingTx)
              ? `Reconciliation Notice: This was a credit card purchase. ${formatCurrencyINR(deletingTx?.amount)} will be returned to the card's available credit, not your bank balance.`
              : `Reconciliation Notice: Deleting this transaction will reverse its effect on your operating balance. ${formatCurrencyINR(deletingTx?.amount)} will be refunded back to your account.`}
            confirmLabel="Delete Transaction"
            variant="danger"
            isLoading={isDeletingTx}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INCOME                                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'income' && (
        <div className="activity-tab-content">
          {incState.error && (
            <SectionError message={incState.error} onRetry={incState.refetch} />
          )}

          {incState.isLoading ? (
            <SkeletonCard height={280} />
          ) : (
            <>
              {/* Toolbar Info */}
              <div className="activity-toolbar">
                <div className="toolbar-search-wrap">
                  <span className="text-secondary text-sm font-medium">
                    Manage multi-source earnings and income flow smoothing
                  </span>
                </div>
              </div>

              {/* Income Summary Strip */}
              <IncomeSummaryStrip
                totalIncome={incState.summary.totalIncome}
                thisMonthIncome={incState.summary.thisMonthIncome}
                averageIncome={incState.summary.averageIncome}
                incomeCount={incState.summary.incomeCount}
                volatility={incState.summary.volatility}
              />

              {/* Income Table */}
              <IncomeTable
                incomes={incState.incomes}
                onEdit={handleOpenEditInc}
                onDelete={(inc) => setDeletingInc(inc)}
                onAddClick={handleOpenAddInc}
              />
            </>
          )}

          {/* Add / Edit Income Modal */}
          <IncomeModal
            isOpen={isIncModalOpen}
            onClose={() => setIsIncModalOpen(false)}
            onSubmit={handleSaveInc}
            initialIncome={editingInc}
          />

          {/* Delete Income Confirmation Dialog */}
          <ConfirmDialog
            isOpen={Boolean(deletingInc)}
            onClose={() => setDeletingInc(null)}
            onConfirm={handleConfirmDeleteInc}
            title="Delete Income Record?"
            message={`Are you sure you want to delete this ${deletingInc?.source || ''} income entry?`}
            warningNote={`Reconciliation Notice: Deleting this income record will decrease your current balance by ${formatCurrencyINR(deletingInc?.amount)}.`}
            confirmLabel="Delete Income"
            variant="danger"
            isLoading={isDeletingInc}
          />
        </div>
      )}

    </div>
  );
};

export default ActivityPage;
