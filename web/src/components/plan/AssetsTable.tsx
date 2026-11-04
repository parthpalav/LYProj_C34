import React, { Fragment, useMemo } from 'react';
import { TrendingUp, Pencil, Trash2, Flame, Ban, Plus, RefreshCw } from 'lucide-react';
import type { Asset } from '../../types';
import { getAssetClassLabel, getAssetLiquidityLabel } from '../../hooks/useAssets';
import { formatDateFull } from '../../utils/formatters';

interface AssetsTableProps {
  assets: Asset[];
  onAddAsset: () => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
  /** One-step value refresh; hidden for deposits whose value the server computes. */
  onUpdateValue?: (asset: Asset) => void;
}

/** Display groups, in order; unknown types fall into the last one. */
const ASSET_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Deposits (FD / RD)', types: ['Fixed Deposit', 'Recurring Deposit'] },
  { label: 'Investments', types: ['Mutual Fund', 'Equity', 'Stocks / Equity', 'Gold', 'Commodities', 'Cryptocurrency'] },
  { label: 'Retirement', types: ['Provident Fund / PPF', 'EPF / PPF', 'NPS'] },
  { label: 'Cash & bank', types: ['Cash & Bank', 'Bank / Savings', 'Cash'] },
  { label: 'Property & other', types: [] },
];

function groupAssets(assets: Asset[]) {
  const last = ASSET_GROUPS.length - 1;
  const idx = (a: Asset) => {
    const i = ASSET_GROUPS.findIndex((g) => g.types.includes(a.assetType));
    return i < 0 ? last : i;
  };
  return ASSET_GROUPS
    .map((g, i) => {
      const rows = assets.filter((a) => idx(a) === i);
      return { label: g.label, rows, total: rows.reduce((s, a) => s + (Number(a.currentValue) || 0), 0) };
    })
    .filter((g) => g.rows.length > 0);
}

const canUpdateValue = (a: Asset) => a.tenureMonths == null;

function formatINR(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

/** SIP / deposit summary shown under the asset name. */
function planLine(asset: Asset): string | null {
  const parts: string[] = [];
  if (asset.monthlyContribution) {
    parts.push(`${asset.assetType === 'Recurring Deposit' ? 'Installment' : 'SIP'} ${formatINR(asset.monthlyContribution)}/mo`);
  }
  if (asset.maturityDate && asset.maturityValue !== undefined) {
    parts.push(`${asset.matured ? 'Matured' : 'Matures'} ${formatDateFull(asset.maturityDate)} · ${formatINR(asset.maturityValue)}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
  onUpdateValue,
}) => {
  const groups = useMemo(() => groupAssets(assets), [assets]);
  // Presentation-only aggregation by assetClass — uses exact persisted values
  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    assets.forEach((a) => {
      const cls = a.assetClass || 'OTHER';
      map[cls] = (map[cls] || 0) + (Number(a.currentValue) || 0);
      total += Number(a.currentValue) || 0;
    });
    return { map, total };
  }, [assets]);

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header plan-section-header--row">
        <div>
          <h3 className="plan-section-title">What you own</h3>
          <p className="plan-section-subtitle">
            Grouped by type. Use Update to refresh a value in one step.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary plan-add-btn"
          onClick={onAddAsset}
        >
          <Plus size={15} /> Add Asset
        </button>
      </div>

      {/* Summary Strip — classification of asset records */}
      {assets.length > 0 && (
        <div className="plan-assets-summary-strip">
          <div className="plan-assets-summary-item">
            <span className="plan-assets-summary-label">Total Assets</span>
            <span className="plan-assets-summary-value">{formatINR(classSummary.total)}</span>
          </div>
          {classSummary.map.FIRE_INVESTABLE !== undefined && (
            <div className="plan-assets-summary-item">
              <span className="plan-assets-summary-label">FIRE Investable</span>
              <span className="plan-assets-summary-value">{formatINR(classSummary.map.FIRE_INVESTABLE || 0)}</span>
            </div>
          )}
          {classSummary.map.SEMI_LIQUID !== undefined && (
            <div className="plan-assets-summary-item">
              <span className="plan-assets-summary-label">Semi-Liquid</span>
              <span className="plan-assets-summary-value">{formatINR(classSummary.map.SEMI_LIQUID || 0)}</span>
            </div>
          )}
          {classSummary.map.NON_INVESTABLE !== undefined && (
            <div className="plan-assets-summary-item">
              <span className="plan-assets-summary-label">Non-Investable</span>
              <span className="plan-assets-summary-value">{formatINR(classSummary.map.NON_INVESTABLE || 0)}</span>
            </div>
          )}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="plan-empty-state">
          <TrendingUp size={40} className="plan-empty-icon" />
          <h4 className="plan-empty-title">No assets recorded yet</h4>
          <p className="plan-empty-desc">
            Add assets to include them in your financial planning view.
          </p>
          <button type="button" className="btn btn-primary" onClick={onAddAsset}>
            Record Your First Asset
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="plan-table-wrapper desktop-only">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Type</th>
                  <th>Classification</th>
                  <th>Liquidity</th>
                  <th>Return</th>
                  <th>Current Value</th>
                  <th>FIRE Status</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              {groups.map((group) => (
              <tbody key={group.label}>
                <tr className="plan-group-row">
                  <th colSpan={8} scope="colgroup">
                    <span>{group.label}</span>
                    <span className="plan-group-total tabular-nums">{formatINR(group.total)}</span>
                  </th>
                </tr>
                {group.rows.map((asset) => {
                  const returnRateStr =
                    asset.annualReturnRate !== undefined && asset.annualReturnRate !== null
                      ? `${(asset.annualReturnRate * 100).toFixed(1)}%`
                      : 'Default (8.0%)';
                  const hasExplicitReturn = asset.annualReturnRate !== undefined && asset.annualReturnRate !== null;

                  return (
                    <tr key={asset.id}>
                      <td className="td-name">
                        <strong>{asset.name}</strong>
                        {planLine(asset) && <span className="td-notes">{planLine(asset)}</span>}
                        {asset.notes && <span className="td-notes">{asset.notes}</span>}
                      </td>
                      <td>
                        <span className="plan-badge plan-badge--type">{asset.assetType}</span>
                      </td>
                      <td>
                        <span className={`plan-badge plan-badge--class plan-badge--${asset.assetClass.toLowerCase()}`}>
                          {getAssetClassLabel(asset.assetClass)}
                        </span>
                      </td>
                      <td>
                        <span className="plan-badge plan-badge--liquidity">
                          {getAssetLiquidityLabel(asset.liquidity)}
                        </span>
                      </td>
                      <td className="td-return">
                        <span className={hasExplicitReturn ? '' : 'plan-text-muted'}>
                          {returnRateStr}
                        </span>
                      </td>
                      <td className="td-value">{formatINR(asset.currentValue)}</td>
                      <td>
                        {asset.includedInFireCorpus ? (
                          <span className="plan-fire-badge plan-fire-badge--in">
                            <Flame size={12} /> In FIRE corpus
                          </span>
                        ) : (
                          <span className="plan-fire-badge plan-fire-badge--out">
                            <Ban size={12} /> Not in FIRE
                          </span>
                        )}
                      </td>
                      <td className="td-actions">
                        {onUpdateValue && canUpdateValue(asset) && (
                          <button
                            type="button"
                            className="plan-icon-btn plan-icon-btn--edit"
                            onClick={() => onUpdateValue(asset)}
                            aria-label={`Update value of ${asset.name}`}
                            title="Update value"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="plan-icon-btn plan-icon-btn--edit"
                          onClick={() => onEditAsset(asset)}
                          aria-label={`Edit ${asset.name}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="plan-icon-btn plan-icon-btn--delete"
                          onClick={() => onDeleteAsset(asset)}
                          aria-label={`Delete ${asset.name}`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              ))}
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="plan-cards-stack mobile-only">
            {groups.map((group) => (
            <Fragment key={group.label}>
            <div className="plan-group-row plan-group-row--card">
              <span>{group.label}</span>
              <span className="plan-group-total tabular-nums">{formatINR(group.total)}</span>
            </div>
            {group.rows.map((asset) => {
              const returnRateStr =
                asset.annualReturnRate !== undefined && asset.annualReturnRate !== null
                  ? `${(asset.annualReturnRate * 100).toFixed(1)}%`
                  : 'Default (8.0%)';

              return (
                <div key={asset.id} className="plan-asset-card">
                  <div className="plan-asset-card-top">
                    <div className="plan-asset-card-identity">
                      <h4 className="plan-asset-card-name">{asset.name}</h4>
                      <span className="plan-badge plan-badge--type">{asset.assetType}</span>
                    </div>
                    <span className="plan-asset-card-value">{formatINR(asset.currentValue)}</span>
                  </div>

                  <div className="plan-asset-card-badges">
                    <span className={`plan-badge plan-badge--class plan-badge--${asset.assetClass.toLowerCase()}`}>
                      {getAssetClassLabel(asset.assetClass)}
                    </span>
                    <span className="plan-badge plan-badge--liquidity">
                      {getAssetLiquidityLabel(asset.liquidity)}
                    </span>
                    {asset.includedInFireCorpus ? (
                      <span className="plan-fire-badge plan-fire-badge--in">
                        <Flame size={11} /> In FIRE
                      </span>
                    ) : (
                      <span className="plan-fire-badge plan-fire-badge--out">
                        <Ban size={11} /> Excluded
                      </span>
                    )}
                  </div>

                  <div className="plan-asset-card-meta">
                    <span>Expected Return: <strong>{returnRateStr}</strong></span>
                    {planLine(asset) && <span>{planLine(asset)}</span>}
                  </div>

                  {asset.notes && <p className="plan-asset-card-notes">{asset.notes}</p>}

                  <div className="plan-asset-card-actions">
                    {onUpdateValue && canUpdateValue(asset) && (
                      <button
                        type="button"
                        className="plan-icon-btn plan-icon-btn--edit"
                        onClick={() => onUpdateValue(asset)}
                        aria-label={`Update value of ${asset.name}`}
                      >
                        <RefreshCw size={13} /> Update
                      </button>
                    )}
                    <button
                      type="button"
                      className="plan-icon-btn plan-icon-btn--edit"
                      onClick={() => onEditAsset(asset)}
                      aria-label={`Edit ${asset.name}`}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className="plan-icon-btn plan-icon-btn--delete"
                      onClick={() => onDeleteAsset(asset)}
                      aria-label={`Delete ${asset.name}`}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
            </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
