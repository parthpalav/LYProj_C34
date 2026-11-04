import React, { useState } from 'react';
import type { Asset } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { updateAsset } from '../../services/api';
import { formatCurrencyINR, formatDateFull } from '../../utils/formatters';

/** Fired after an asset changes outside the Plan page so open asset lists refetch. */
export const ASSETS_CHANGED_EVENT = 'assets:changed';

interface AssetReviewModalProps {
  /** Render with key={asset.id} so the form resets per asset. */
  asset: Asset;
  onClose: () => void;
  onSaved: () => void;
}

/** Monthly check-in for a market-linked asset: confirm or correct its value and expected return. */
export const AssetReviewModal: React.FC<AssetReviewModalProps> = ({ asset, onClose, onSaved }) => {
  const [value, setValue] = useState(() => String(asset.currentValue ?? ''));
  const [rate, setRate] = useState(() => (asset.annualReturnRate != null ? String(Math.round(asset.annualReturnRate * 1000) / 10) : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value);
    const r = rate.trim() === '' ? null : Number(rate);
    if (value.trim() === '' || !(v >= 0)) return setError('Current value must be 0 or more');
    if (r !== null && !(r >= 0 && r <= 100)) return setError('Expected return must be between 0% and 100%');
    try {
      setSaving(true);
      await updateAsset(asset.id, { currentValue: v, annualReturnRate: r === null ? null : r / 100 });
      window.dispatchEvent(new Event(ASSETS_CHANGED_EVENT));
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const last = asset.lastReviewedAt || asset.createdAt;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Monthly check-in: ${asset.name}`}
      subtitle={`${asset.assetType}${last ? ` · last confirmed ${formatDateFull(last)}` : ''}`}
      maxWidth="460px"
    >
      <form onSubmit={handleSubmit} className="plan-modal-form">
        {error && (
          <div className="form-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}
        <div className="form-group">
          <label htmlFor="review-value" className="form-label">Current Value (₹)</label>
          <input
            id="review-value"
            type="number"
            step="any"
            min="0"
            className="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          {asset.monthlyContribution ? (
            <span className="input-hint">Include this month's SIP of {formatCurrencyINR(asset.monthlyContribution)}.</span>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="review-rate" className="form-label">Expected Return (% / yr)</label>
          <input
            id="review-rate"
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="form-input"
            placeholder="Default (8%)"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Later</Button>
          <Button type="submit" variant="primary" isLoading={saving}>Confirm</Button>
        </div>
      </form>
    </Modal>
  );
};
