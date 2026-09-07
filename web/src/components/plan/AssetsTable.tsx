import React from 'react';
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
  return (
    <div className="assets-table-container">
      <div className="assets-table-header">
        <div>
          <h3 className="assets-title">Financial Assets Ledger</h3>
          <p className="assets-subtitle">
            Manage your investment portfolio, liquid reserves, and capital assets
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary add-asset-btn"
          onClick={onAddAsset}
        >
          + Add New Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="assets-empty-state">
          <div className="empty-icon">📈</div>
          <h4 className="empty-title">No assets recorded yet</h4>
          <p className="empty-desc">
            Add assets to build a clearer view of your financial independence and retirement projections.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddAsset}
          >
            Record Your First Asset
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="assets-table-wrapper desktop-only">
            <table className="assets-table">
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

                  return (
                    <tr key={asset.id}>
                      <td className="td-name">
                        <strong>{asset.name}</strong>
                        {asset.notes && <span className="td-notes">{asset.notes}</span>}
                      </td>
                      <td>
                        <span className="badge badge-type">{asset.assetType}</span>
                      </td>
                      <td>
                        <span className={`badge badge-class badge-${asset.assetClass.toLowerCase()}`}>
                          {getAssetClassLabel(asset.assetClass)}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-liquidity">
                          {getAssetLiquidityLabel(asset.liquidity)}
                        </span>
                      </td>
                      <td className="td-return">{returnRateStr}</td>
                      <td className="td-value">{formatINR(asset.currentValue)}</td>
                      <td>
                        {asset.includedInFireCorpus ? (
                          <span className="fire-badge fire-included">🔥 In FIRE</span>
                        ) : (
                          <span className="fire-badge fire-excluded">Excluded</span>
                        )}
                      </td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="btn-action edit"
                          onClick={() => onEditAsset(asset)}
                          aria-label={`Edit ${asset.name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action delete"
                          onClick={() => onDeleteAsset(asset)}
                          aria-label={`Delete ${asset.name}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="assets-cards-wrapper mobile-only">
            {assets.map((asset) => {
              const returnRateStr =
                asset.annualReturnRate !== undefined && asset.annualReturnRate !== null
                  ? `${(asset.annualReturnRate * 100).toFixed(1)}%`
                  : 'Default (8.0%)';

              return (
                <div key={asset.id} className="asset-mobile-card">
                  <div className="card-top">
                    <div className="card-identity">
                      <h4 className="card-name">{asset.name}</h4>
                      <span className="badge badge-type">{asset.assetType}</span>
                    </div>
                    <span className="card-value">{formatINR(asset.currentValue)}</span>
                  </div>

                  <div className="card-badges">
                    <span className={`badge badge-class badge-${asset.assetClass.toLowerCase()}`}>
                      {getAssetClassLabel(asset.assetClass)}
                    </span>
                    <span className="badge badge-liquidity">
                      {getAssetLiquidityLabel(asset.liquidity)}
                    </span>
                    {asset.includedInFireCorpus ? (
                      <span className="fire-badge fire-included">🔥 In FIRE</span>
                    ) : (
                      <span className="fire-badge fire-excluded">Excluded</span>
                    )}
                  </div>

                  <div className="card-meta">
                    <span>Expected Return: <strong>{returnRateStr}</strong></span>
                  </div>

                  {asset.notes && <p className="card-notes">{asset.notes}</p>}

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-action edit"
                      onClick={() => onEditAsset(asset)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-action delete"
                      onClick={() => onDeleteAsset(asset)}
                    >
                      Delete
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
