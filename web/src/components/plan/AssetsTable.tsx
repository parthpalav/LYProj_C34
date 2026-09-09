import React, { useMemo } from 'react';
import { TrendingUp, Pencil, Trash2, Flame, Ban, Plus } from 'lucide-react';
import type { Asset } from '../../types';
import { getAssetClassLabel, getAssetLiquidityLabel } from '../../hooks/useAssets';

interface AssetsTableProps {
  assets: Asset[];
  onAddAsset: () => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}

function formatINR(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
}) => {
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
          <h3 className="plan-section-title">Financial Assets Ledger</h3>
          <p className="plan-section-subtitle">
            Manage your investment portfolio, liquid reserves, and capital assets
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
                  <th>Expected Return</th>
                  <th>Current Value</th>
                  <th>FIRE Status</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const returnRateStr =
                    asset.annualReturnRate !== undefined && asset.annualReturnRate !== null
                      ? `${(asset.annualReturnRate * 100).toFixed(1)}%`
                      : 'Default (8.0%)';
                  const hasExplicitReturn = asset.annualReturnRate !== undefined && asset.annualReturnRate !== null;

                  return (
                    <tr key={asset.id}>
                      <td className="td-name">
                        <strong>{asset.name}</strong>
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
                            <Flame size={12} /> Included in FIRE corpus
                          </span>
                        ) : (
                          <span className="plan-fire-badge plan-fire-badge--out">
                            <Ban size={12} /> Excluded from FIRE corpus
                          </span>
                        )}
                      </td>
                      <td className="td-actions">
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
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="plan-cards-stack mobile-only">
            {assets.map((asset) => {
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
                  </div>

                  {asset.notes && <p className="plan-asset-card-notes">{asset.notes}</p>}

                  <div className="plan-asset-card-actions">
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
          </div>
        </>
      )}
    </div>
  );
};
