import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions';
import { useIncome } from '../hooks/useIncome';
import { useLiabilities } from '../hooks/useLiabilities';
import type { Transaction, IncomeRecord, Liability, TransactionPayload, IncomePayload, LiabilityPayload } from '../types';
import { formatCurrencyINR } from '../utils/formatters';

import { ActivityTabs, type ActivityTabKey } from '../components/activity/ActivityTabs';
import { TransactionSummaryStrip } from '../components/activity/TransactionSummaryStrip';
import { TransactionFilterToolbar } from '../components/activity/TransactionFilterToolbar';
import { TransactionTable } from '../components/activity/TransactionTable';
import { TransactionModal } from '../components/activity/TransactionModal';

import { IncomeSummaryStrip } from '../components/activity/IncomeSummaryStrip';
import { IncomeTable } from '../components/activity/IncomeTable';
import { IncomeModal } from '../components/activity/IncomeModal';

import { LiabilitySummaryStrip } from '../components/activity/LiabilitySummaryStrip';
import { LiabilityTable } from '../components/activity/LiabilityTable';
import { LiabilityModal } from '../components/activity/LiabilityModal';
import { LiabilityHistoryModal } from '../components/activity/LiabilityHistoryModal';

import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { SectionError } from '../components/dashboard/SectionError';

export const ActivityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State preserved in URL (?tab=transactions | income | liabilities)
  const tabParam = searchParams.get('tab');
  const activeTab: ActivityTabKey =
    tabParam === 'income' || tabParam === 'liabilities' ? tabParam : 'transactions';

  const handleTabChange = (newTab: ActivityTabKey) => {
    setSearchParams({ tab: newTab });
  };

  // Domain Hooks
  const txState = useTransactions();
  const incState = useIncome();
  const liabState = useLiabilities();

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' | 'info' }>({
    message: null,
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
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
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Income modals & actions state
  const [isIncModalOpen, setIsIncModalOpen] = useState(false);
  const [editingInc, setEditingInc] = useState<IncomeRecord | null>(null);
  const [deletingInc, setDeletingInc] = useState<IncomeRecord | null>(null);
  const [isDeletingInc, setIsDeletingInc] = useState(false);

  // Liability modals & actions state
  const [isLiabModalOpen, setIsLiabModalOpen] = useState(false);
  const [editingLiab, setEditingLiab] = useState<Liability | null>(null);
  const [deletingLiab, setDeletingLiab] = useState<Liability | null>(null);
  const [isDeletingLiab, setIsDeletingLiab] = useState(false);
  const [historyLiab, setHistoryLiab] = useState<Liability | null>(null);

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
      showToast('Transaction updated successfully.');
    } else {
      await txState.add(payload);
      showToast('Transaction added to ledger.');
    }
  };

  const handleConfirmDeleteTx = async () => {
    if (!deletingTx) return;
    setIsDeletingTx(true);
    try {
      await txState.remove(deletingTx.id);
      showToast(`Transaction deleted. ₹${deletingTx.amount} refunded to balance.`);
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
      showToast('Income recorded. Balance credited.');
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

  // ── Liability Action Handlers ─────────────────────────────────────────────

  const handleOpenAddLiab = () => {
    setEditingLiab(null);
    setIsLiabModalOpen(true);
  };

  const handleOpenEditLiab = (l: Liability) => {
    setEditingLiab(l);
    setIsLiabModalOpen(true);
  };

  const handleSaveLiab = async (payload: LiabilityPayload) => {
    if (editingLiab) {
      await liabState.edit(editingLiab.id, payload);
      showToast('Recurring liability updated.');
    } else {
      await liabState.add(payload);
      showToast('Recurring liability created.');
    }
  };

  const handleConfirmDeleteLiab = async () => {
    if (!deletingLiab) return;
    setIsDeletingLiab(true);
    try {
      await liabState.remove(deletingLiab.id);
      showToast(`Obligation removed.`);
      setDeletingLiab(null);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to remove liability.', 'error');
    } finally {
      setIsDeletingLiab(false);
    }
  };

  const isTxFiltered =
    Boolean(txState.searchQuery.trim()) ||
    txState.categoryFilter !== 'ALL' ||
    txState.typeFilter !== 'ALL' ||
    txState.dateFilter !== 'all' ||
    Boolean(txState.customStartDate) ||
    Boolean(txState.customEndDate);

  return (
    <div className="activity-page animate-fade-in">
      {/* Toast Notification Container */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: null, type: 'success' })}
      />

      {/* Header Section */}
      <div className="overview-header">
        <div className="overview-header-left">
          <span className="overview-context-badge">MONEY & CASH FLOW</span>
          <h1 className="overview-title">Financial Activity</h1>
          <p className="overview-subtitle">
            Inspect, record, and maintain your transactions, income streams, and recurring liabilities
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <ActivityTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={{
          transactions: txState.transactions.length,
          income: incState.incomes.length,
          liabilities: liabState.liabilities.length,
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
              />

              {/* Filter Summary Strip */}
              <TransactionSummaryStrip
                count={txState.summary.count}
                totalSpend={txState.summary.totalSpend}
                needsTotal={txState.summary.needsTotal}
                wantsTotal={txState.summary.wantsTotal}
                investmentsTotal={txState.summary.investmentsTotal}
                isFiltered={isTxFiltered}
              />

              {/* Transactions Ledger Table / Cards */}
              <TransactionTable
                transactions={txState.paginatedTransactions}
                page={txState.page}
                totalPages={txState.totalPages}
                onPageChange={txState.setPage}
                onEdit={handleOpenEditTx}
                onDelete={(tx) => setDeletingTx(tx)}
                onAddClick={handleOpenAddTx}
                totalFilteredCount={txState.filteredTransactions.length}
              />
            </>
          )}

          {/* Add / Edit Transaction Modal */}
          <TransactionModal
            isOpen={isTxModalOpen}
            onClose={() => setIsTxModalOpen(false)}
            onSubmit={handleSaveTx}
            initialTransaction={editingTx}
          />

          {/* Delete Transaction Confirmation Dialog */}
          <ConfirmDialog
            isOpen={Boolean(deletingTx)}
            onClose={() => setDeletingTx(null)}
            onConfirm={handleConfirmDeleteTx}
            title="Delete Transaction?"
            message={`Are you sure you want to delete "${deletingTx?.description || 'this transaction'}"?`}
            warningNote={`Reconciliation Notice: Deleting this transaction will reverse its effect on your operating balance. ${formatCurrencyINR(deletingTx?.amount)} will be refunded back to your account.`}
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
              {/* Toolbar */}
              <div className="activity-toolbar">
                <div className="toolbar-search-wrap">
                  <span className="text-secondary text-sm font-medium">
                    Manage multi-source earnings and income flow smoothing
                  </span>
                </div>
                <div className="toolbar-controls-row">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleOpenAddInc}
                    className="add-activity-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Record Income</span>
                  </Button>
                </div>
              </div>

              {/* Income Summary Strip */}
              <IncomeSummaryStrip
                totalIncome={incState.summary.totalIncome}
                thisMonthIncome={incState.summary.thisMonthIncome}
                averageIncome={incState.summary.averageIncome}
                incomeCount={incState.summary.incomeCount}
                volatility={incState.summary.volatility}
                dailySmoothed={incState.summary.dailySmoothed}
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: LIABILITIES                                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'liabilities' && (
        <div className="activity-tab-content">
          {liabState.error && (
            <SectionError message={liabState.error} onRetry={liabState.refetch} />
          )}

          {liabState.isLoading ? (
            <SkeletonCard height={280} />
          ) : (
            <>
              {/* Toolbar */}
              <div className="activity-toolbar">
                <div className="toolbar-search-wrap">
                  <span className="text-secondary text-sm font-medium">
                    Recurring commitments, auto-deductions, and schedule tracking
                  </span>
                </div>
                <div className="toolbar-controls-row">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleOpenAddLiab}
                    className="add-activity-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Liability</span>
                  </Button>
                </div>
              </div>

              {/* Liability Summary Strip */}
              <LiabilitySummaryStrip
                activeCount={liabState.summary.activeCount}
                dueNext30Days={liabState.summary.dueNext30Days}
                nearestDueDate={liabState.summary.nearestDueDate}
              />

              {/* Liability Table */}
              <LiabilityTable
                liabilities={liabState.liabilities}
                onEdit={handleOpenEditLiab}
                onDelete={(l) => setDeletingLiab(l)}
                onViewHistory={(l) => setHistoryLiab(l)}
                onAddClick={handleOpenAddLiab}
              />
            </>
          )}

          {/* Add / Edit Liability Modal */}
          <LiabilityModal
            isOpen={isLiabModalOpen}
            onClose={() => setIsLiabModalOpen(false)}
            onSubmit={handleSaveLiab}
            initialLiability={editingLiab}
          />

          {/* Liability Payment History Modal */}
          <LiabilityHistoryModal
            isOpen={Boolean(historyLiab)}
            onClose={() => setHistoryLiab(null)}
            liability={historyLiab}
          />

          {/* Remove Liability Confirmation Dialog */}
          <ConfirmDialog
            isOpen={Boolean(deletingLiab)}
            onClose={() => setDeletingLiab(null)}
            onConfirm={handleConfirmDeleteLiab}
            title="Remove Recurring Obligation?"
            message={`Are you sure you want to remove "${deletingLiab?.name}"?`}
            warningNote="Schedule Notice: Removing this liability deactivates it and disables any future scheduled auto-deductions. Prior transactions recorded by this obligation remain intact in your ledger."
            confirmLabel="Remove Obligation"
            variant="danger"
            isLoading={isDeletingLiab}
          />
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
