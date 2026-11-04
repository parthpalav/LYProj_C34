import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark, CalendarClock, PieChart, Plus } from 'lucide-react';

import { NetWorthSummary } from '../components/plan/NetWorthSummary';
import { NetWorthCompositionChart } from '../components/plan/NetWorthCompositionChart';
import { NetWorthHistoryNotice } from '../components/plan/NetWorthHistoryNotice';
import { AssetsTable } from '../components/plan/AssetsTable';
import { AssetModal } from '../components/plan/AssetModal';
import { AssetReviewModal } from '../components/plan/AssetReviewModal';
import { CreditCardsSection } from '../components/activity/CreditCardsSection';
import { LiabilitySummaryStrip } from '../components/activity/LiabilitySummaryStrip';
import { LiabilityTable } from '../components/activity/LiabilityTable';
import { LiabilityModal } from '../components/activity/LiabilityModal';
import { LiabilityHistoryModal } from '../components/activity/LiabilityHistoryModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { SectionError } from '../components/dashboard/SectionError';

import { useNetWorth } from '../hooks/useNetWorth';
import { useAssets } from '../hooks/useAssets';
import { useLiabilities } from '../hooks/useLiabilities';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { formatCurrencyINR } from '../utils/formatters';
import type { Asset, Liability, LiabilityPayload } from '../types';

type TabKey = 'assets' | 'liabilities' | 'breakdown';

/** A loan carries a balance; everything else recurring is a bill. */
const isLoan = (l: Liability) => l.outstandingBalance != null || l.category === 'Debt & Loan Payments';

/** Everything you own and owe in one place: assets, loans, cards and bills, each editable in place. */
export const NetWorthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = tabParam === 'liabilities' || tabParam === 'breakdown' ? tabParam : 'assets';

  const netWorth = useNetWorth();
  const assetsDomain = useAssets();
  const liabState = useLiabilities();
  const payState = usePaymentMethods();
  const creditCards = payState.active.filter((m) => m.kind === 'credit_card');
  const loans = liabState.liabilities.filter(isLoan);
  const bills = liabState.liabilities.filter((l) => !isLoan(l));

  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' | 'info' | 'warning' }>({ message: null, type: 'success' });
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => setToast({ message, type });

  // Assets
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [assetToUpdate, setAssetToUpdate] = useState<Asset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);

  // Liabilities
  const [liabModalOpen, setLiabModalOpen] = useState(false);
  const [editingLiab, setEditingLiab] = useState<Liability | null>(null);
  const [deletingLiab, setDeletingLiab] = useState<Liability | null>(null);
  const [isDeletingLiab, setIsDeletingLiab] = useState(false);
  const [historyLiab, setHistoryLiab] = useState<Liability | null>(null);

  const refreshTotals = () => void netWorth.refresh(true);

  const openAddAsset = () => { setAssetToEdit(null); setAssetModalOpen(true); };
  const openAddLiab = () => { setEditingLiab(null); setLiabModalOpen(true); };

  const handleSaveAsset = async (payload: any) => {
    if (assetToEdit) await assetsDomain.editAsset(assetToEdit.id, payload);
    else await assetsDomain.addAsset(payload);
    refreshTotals();
  };

  const handleConfirmDeleteAsset = async () => {
    if (!assetToDelete) return;
    try {
      setDeletingAsset(true);
      await assetsDomain.removeAsset(assetToDelete.id);
      setAssetToDelete(null);
      refreshTotals();
    } finally {
      setDeletingAsset(false);
    }
  };

  const handleSaveLiab = async (payload: LiabilityPayload) => {
    if (editingLiab) {
      await liabState.edit(editingLiab.id, payload);
      showToast('Liability updated.');
    } else {
      await liabState.add(payload);
      showToast('Liability added.');
    }
    refreshTotals();
  };

  const handleConfirmDeleteLiab = async () => {
    if (!deletingLiab) return;
    setIsDeletingLiab(true);
    try {
      await liabState.remove(deletingLiab.id);
      showToast('Obligation removed.');
      setDeletingLiab(null);
      refreshTotals();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to remove liability.', 'error');
    } finally {
      setIsDeletingLiab(false);
    }
  };

  const liabilityTable = (rows: Liability[]) => (
    <LiabilityTable
      liabilities={rows}
      onEdit={(l) => { setEditingLiab(l); setLiabModalOpen(true); }}
      onDelete={(l) => setDeletingLiab(l)}
      onViewHistory={(l) => setHistoryLiab(l)}
      onAddClick={openAddLiab}
    />
  );

  const tabs: { key: TabKey; label: string; Icon: React.FC<any>; meta?: string }[] = [
    { key: 'assets', label: 'Assets', Icon: Landmark, meta: formatCurrencyINR(netWorth.totalAssetValue) },
    { key: 'liabilities', label: 'Liabilities', Icon: CalendarClock, meta: formatCurrencyINR(netWorth.totalLiabilities) },
    { key: 'breakdown', label: 'Breakdown', Icon: PieChart },
  ];

  return (
    <div className="plan-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />

      <div className="page-header-section">
        <div>
          <span className="page-header-eyebrow">ASSETS & LIABILITIES</span>
          <h1 className="page-header-title">Net worth</h1>
          <p className="page-header-subtitle">
            Everything you own and owe: deposits, investments, loans, cards and bills.
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" variant="outline" size="sm" onClick={openAddLiab} leftIcon={<Plus size={15} />}>
            Add liability
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={openAddAsset} leftIcon={<Plus size={15} />}>
            Add asset
          </Button>
        </div>
      </div>

      {netWorth.loading ? (
        <SkeletonCard height={160} />
      ) : (
        <NetWorthSummary
          knownNetWorth={netWorth.knownNetWorth}
          totalAssetValue={netWorth.totalAssetValue}
          totalLiabilities={netWorth.totalLiabilities}
          operationalCash={netWorth.operationalCash}
          liquidBuffer={netWorth.liquidBuffer}
          fireInvestableCorpus={netWorth.fireInvestableCorpus}
        />
      )}

      <div className="unified-tab-container" role="tablist" aria-label="Net worth sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            className={`unified-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: tab.key })}
          >
            <tab.Icon size={15} aria-hidden="true" />
            <span>{tab.label}</span>
            {tab.meta && <span className="unified-tab-meta tabular-nums">{tab.meta}</span>}
          </button>
        ))}
      </div>

      <div className="plan-tab-content">
        {activeTab === 'assets' && (
          <div className="plan-tab-pane plan-tab-pane--enter">
            {assetsDomain.loading ? (
              <SkeletonCard height={380} />
            ) : assetsDomain.error ? (
              <SectionError message={assetsDomain.error} onRetry={() => assetsDomain.refresh(true)} />
            ) : (
              <AssetsTable
                assets={assetsDomain.assets}
                onAddAsset={openAddAsset}
                onEditAsset={(a) => { setAssetToEdit(a); setAssetModalOpen(true); }}
                onDeleteAsset={(a) => setAssetToDelete(a)}
                onUpdateValue={(a) => setAssetToUpdate(a)}
              />
            )}
          </div>
        )}

        {activeTab === 'liabilities' && (
          <div className="plan-tab-pane plan-tab-pane--enter activity-tab-content">
            {liabState.error && <SectionError message={liabState.error} onRetry={liabState.refetch} />}
            {liabState.isLoading ? (
              <SkeletonCard height={280} />
            ) : (
              <>
                <LiabilitySummaryStrip
                  activeCount={liabState.summary.activeCount}
                  dueNext30Days={liabState.summary.dueNext30Days}
                  nearestDueDate={liabState.summary.nearestDueDate}
                />
                {loans.length > 0 && (
                  <section className="networth-group">
                    <h3 className="networth-group-title">Loans & EMIs</h3>
                    {liabilityTable(loans)}
                  </section>
                )}
                <CreditCardsSection cards={creditCards} onChanged={() => { payState.refetch(); refreshTotals(); }} notify={showToast} />
                {(bills.length > 0 || loans.length === 0) && (
                  <section className="networth-group">
                    <h3 className="networth-group-title">Bills & subscriptions</h3>
                    {liabilityTable(bills)}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="plan-tab-pane plan-tab-pane--enter">
            {netWorth.error ? (
              <SectionError message={netWorth.error} onRetry={refreshTotals} />
            ) : (
              <>
                <NetWorthCompositionChart
                  assets={netWorth.assets}
                  liabilities={netWorth.liabilities}
                  totalAssetValue={netWorth.totalAssetValue}
                  totalLiabilities={netWorth.totalLiabilities}
                />
                <NetWorthHistoryNotice />
              </>
            )}
          </div>
        )}
      </div>

      <AssetModal isOpen={assetModalOpen} onClose={() => setAssetModalOpen(false)} onSave={handleSaveAsset} assetToEdit={assetToEdit} />
      {assetToUpdate && (
        <AssetReviewModal
          key={assetToUpdate.id}
          asset={assetToUpdate}
          onClose={() => setAssetToUpdate(null)}
          onSaved={() => { void assetsDomain.refresh(true); refreshTotals(); showToast(`${assetToUpdate.name} updated.`); }}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(assetToDelete)}
        onClose={() => setAssetToDelete(null)}
        onConfirm={handleConfirmDeleteAsset}
        title="Delete Financial Asset"
        message={`Are you sure you want to delete "${assetToDelete?.name}"?`}
        warningNote="This asset will be permanently removed from your balance sheet and excluded from FIRE calculations."
        confirmLabel="Delete Asset"
        isLoading={deletingAsset}
      />

      <LiabilityModal isOpen={liabModalOpen} onClose={() => setLiabModalOpen(false)} onSubmit={handleSaveLiab} initialLiability={editingLiab} />
      <LiabilityHistoryModal isOpen={Boolean(historyLiab)} onClose={() => setHistoryLiab(null)} liability={historyLiab} />
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
  );
};

export default NetWorthPage;
