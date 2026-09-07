/* oxlint-disable react/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import type { Asset, AssetClass, AssetLiquidity } from '../../types';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<any>;
  assetToEdit?: Asset | null;
}

const COMMON_ASSET_TYPES = [
  'Mutual Fund',
  'Equity',
  'Fixed Deposit',
  'Provident Fund / PPF',
  'Cash & Bank',
  'Gold',
  'Real Estate',
  'Cryptocurrency',
  'Other',
];

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  assetToEdit,
}) => {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('Mutual Fund');
  const [assetClass, setAssetClass] = useState<AssetClass>('FIRE_INVESTABLE');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [annualReturnRate, setAnnualReturnRate] = useState<string>('8.0');
  const [liquidity, setLiquidity] = useState<AssetLiquidity>('liquid');
  const [includedInFireCorpus, setIncludedInFireCorpus] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assetToEdit) {
      setName(assetToEdit.name || '');
      setAssetType(assetToEdit.assetType || 'Mutual Fund');
      setAssetClass(assetToEdit.assetClass || 'FIRE_INVESTABLE');
      setCurrentValue(String(assetToEdit.currentValue || ''));
      setAnnualReturnRate(
        assetToEdit.annualReturnRate !== undefined && assetToEdit.annualReturnRate !== null
          ? String(Math.round(assetToEdit.annualReturnRate * 1000) / 10)
          : ''
      );
      setLiquidity(assetToEdit.liquidity || 'liquid');
      setIncludedInFireCorpus(Boolean(assetToEdit.includedInFireCorpus));
      setNotes(assetToEdit.notes || '');
    } else {
      setName('');
      setAssetType('Mutual Fund');
      setAssetClass('FIRE_INVESTABLE');
      setCurrentValue('');
      setAnnualReturnRate('8.0');
      setLiquidity('liquid');
      setIncludedInFireCorpus(true);
      setNotes('');
    }
    setError(null);
  }, [assetToEdit, isOpen]);

  // Invariant enforcement: NON_INVESTABLE cannot count toward FIRE
  const handleClassChange = (newClass: AssetClass) => {
    setAssetClass(newClass);
    if (newClass === 'NON_INVESTABLE') {
      setIncludedInFireCorpus(false);
    } else if (!assetToEdit) {
      setIncludedInFireCorpus(true);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }

    const numVal = parseFloat(currentValue);
    if (isNaN(numVal) || numVal < 0) {
      setError('Current value must be a non-negative number');
      return;
    }

    let parsedReturnRate: number | null = null;
    if (annualReturnRate.trim() !== '') {
      const rateVal = parseFloat(annualReturnRate);
      if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
        setError('Expected return rate must be between 0% and 100%');
        return;
      }
      parsedReturnRate = rateVal / 100;
    }

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        assetType: assetType.trim(),
        assetClass,
        currentValue: numVal,
        annualReturnRate: parsedReturnRate,
        liquidity,
        includedInFireCorpus: assetClass === 'NON_INVESTABLE' ? false : includedInFireCorpus,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const isNonInvestable = assetClass === 'NON_INVESTABLE';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">{assetToEdit ? 'Edit Financial Asset' : 'Add New Financial Asset'}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="asset-name" className="form-label">
              Asset Name *
            </label>
            <input
              id="asset-name"
              type="text"
              className="form-input"
              placeholder="e.g. Nifty 50 Index Fund SIP, SBI Fixed Deposit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="asset-type" className="form-label">
                Asset Type
              </label>
              <select
                id="asset-type"
                className="form-select"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                {COMMON_ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="asset-class" className="form-label">
                Classification *
              </label>
              <select
                id="asset-class"
                className="form-select"
                value={assetClass}
                onChange={(e) => handleClassChange(e.target.value as AssetClass)}
              >
                <option value="FIRE_INVESTABLE">FIRE Investable (Core Portfolio)</option>
                <option value="SEMI_LIQUID">Semi-Liquid (Emergency / Buffer)</option>
                <option value="NON_INVESTABLE">Non-Investable (Primary Home / Lifestyle)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="current-value" className="form-label">
                Current Value (₹) *
              </label>
              <input
                id="current-value"
                type="number"
                step="any"
                min="0"
                className="form-input"
                placeholder="₹ Amount"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                required
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="annual-return" className="form-label">
                Expected Annual Return (%)
              </label>
              <input
                id="annual-return"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="form-input"
                placeholder="e.g. 10.0"
                value={annualReturnRate}
                onChange={(e) => setAnnualReturnRate(e.target.value)}
              />
              <span className="input-hint">Leave blank to use profile default (8%)</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="asset-liquidity" className="form-label">
                Liquidity
              </label>
              <select
                id="asset-liquidity"
                className="form-select"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value as AssetLiquidity)}
              >
                <option value="liquid">Liquid (Ready Cash, Savings, Stocks)</option>
                <option value="locked">Locked (PPF, EPF, Real Estate, Term FD)</option>
                <option value="restricted">Restricted (Lock-in Period / Penalties)</option>
              </select>
            </div>

            <div className="form-group flex-1 checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includedInFireCorpus}
                  disabled={isNonInvestable}
                  onChange={(e) => setIncludedInFireCorpus(e.target.checked)}
                />
                <span>Include in FIRE Retirement Corpus</span>
              </label>
              {isNonInvestable && (
                <span className="input-hint hint-warning">
                  Non-investable assets cannot count toward the FIRE corpus.
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="asset-notes" className="form-label">
              Notes / Description (Optional)
            </label>
            <textarea
              id="asset-notes"
              className="form-textarea"
              rows={2}
              placeholder="Account numbers, folio info, maturity date..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : assetToEdit ? 'Save Changes' : 'Record Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
