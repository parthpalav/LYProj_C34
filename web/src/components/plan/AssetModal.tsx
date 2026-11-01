/* oxlint-disable react/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import type { Asset, AssetClass, AssetLiquidity } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FIXED_INCOME_TYPES } from '../../utils/dueAlerts';
import { dateKey, dateKeyToDate, todayKey } from '../../utils/timezone';

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
  'Recurring Deposit',
  'Provident Fund / PPF',
  'Cash & Bank',
  'Gold',
  'Commodities',
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
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');
  const [principal, setPrincipal] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [tenureMonths, setTenureMonths] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const isFixed = FIXED_INCOME_TYPES.includes(assetType);
  const isRD = assetType === 'Recurring Deposit';
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
      setMonthlyContribution(assetToEdit.monthlyContribution != null ? String(assetToEdit.monthlyContribution) : '');
      setPrincipal(assetToEdit.principal != null ? String(assetToEdit.principal) : '');
      setStartDate(assetToEdit.startDate ? dateKey(assetToEdit.startDate) : todayKey());
      setTenureMonths(assetToEdit.tenureMonths != null ? String(assetToEdit.tenureMonths) : '');
    } else {
      setName('');
      setAssetType('Mutual Fund');
      setAssetClass('FIRE_INVESTABLE');
      setCurrentValue('');
      setAnnualReturnRate('8.0');
      setLiquidity('liquid');
      setIncludedInFireCorpus(true);
      setNotes('');
      setMonthlyContribution('');
      setPrincipal('');
      setStartDate(todayKey());
      setTenureMonths('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }

    const numVal = parseFloat(currentValue);
    if (!isFixed && (isNaN(numVal) || numVal < 0)) {
      setError('Current value must be a non-negative number');
      return;
    }

    const sip = monthlyContribution.trim() === '' ? null : Number(monthlyContribution);
    const deposit = Number(principal);
    const tenure = Number(tenureMonths);
    if (isFixed) {
      if (isRD ? !(sip !== null && sip > 0) : !(deposit > 0)) {
        setError(isRD ? 'Monthly installment must be greater than 0' : 'Deposit amount must be greater than 0');
        return;
      }
      if (annualReturnRate.trim() === '') {
        setError('Interest rate is required for a deposit');
        return;
      }
      if (!startDate || startDate > todayKey()) {
        setError('Start date is required and cannot be in the future');
        return;
      }
      if (!(Number.isInteger(tenure) && tenure >= 1 && tenure <= 600)) {
        setError('Tenure must be a whole number of months (1 - 600)');
        return;
      }
    } else if (sip !== null && !(sip >= 0)) {
      setError('Monthly SIP must be 0 or more');
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
        // FD/RD value is computed by the server from the deposit details.
        ...(isFixed
          ? {
              principal: isRD ? null : deposit,
              startDate: dateKeyToDate(startDate).toISOString(),
              tenureMonths: tenure,
            }
          : { currentValue: numVal, principal: null, startDate: null, tenureMonths: null }),
        monthlyContribution: sip,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assetToEdit ? 'Edit Financial Asset' : 'Record New Asset'}
      subtitle={
        assetToEdit
          ? 'Update valuation, expected growth return, or FIRE allocation'
          : 'Track holdings across investments, liquid funds, or property'
      }
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="plan-modal-form">
        {error && (
          <div className="form-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="asset-name" className="form-label">
            Asset Name <span className="text-danger">*</span>
          </label>
          <input
            id="asset-name"
            type="text"
            className="form-input"
            placeholder="e.g. Nifty 50 Index Fund, SBI Fixed Deposit"
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
              onChange={(e) => {
                const next = e.target.value;
                setAssetType(next);
                // Deposits can't be spent until maturity; new ones default to locked.
                if (!assetToEdit && FIXED_INCOME_TYPES.includes(next)) setLiquidity('locked');
                else if (!assetToEdit && FIXED_INCOME_TYPES.includes(assetType)) setLiquidity('liquid');
              }}
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
              Classification <span className="text-danger">*</span>
            </label>
            <select
              id="asset-class"
              className="form-select"
              value={assetClass}
              onChange={(e) => handleClassChange(e.target.value as AssetClass)}
            >
              <option value="FIRE_INVESTABLE">FIRE Investable (Core Portfolio)</option>
              <option value="SEMI_LIQUID">Semi-Liquid (Emergency / Buffer)</option>
              <option value="NON_INVESTABLE">Non-Investable (Primary Residence / Locked)</option>
            </select>
          </div>
        </div>

        {isFixed ? (
          <>
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="deposit-amount" className="form-label">
                  {isRD ? 'Monthly Installment (₹)' : 'Deposit Amount (₹)'} <span className="text-danger">*</span>
                </label>
                <div className="input-currency-wrapper">
                  <span className="currency-prefix">₹</span>
                  <input
                    id="deposit-amount"
                    type="number"
                    step="any"
                    min="0"
                    className="form-input currency-input"
                    placeholder="0.00"
                    value={isRD ? monthlyContribution : principal}
                    onChange={(e) => (isRD ? setMonthlyContribution : setPrincipal)(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group flex-1">
                <label htmlFor="annual-return" className="form-label">
                  Interest Rate (% / yr) <span className="text-danger">*</span>
                </label>
                <input
                  id="annual-return"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-input"
                  placeholder="e.g. 7.1"
                  value={annualReturnRate}
                  onChange={(e) => setAnnualReturnRate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="deposit-start" className="form-label">
                  Start Date <span className="text-danger">*</span>
                </label>
                <input
                  id="deposit-start"
                  type="date"
                  className="form-input"
                  max={todayKey()}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group flex-1">
                <label htmlFor="deposit-tenure" className="form-label">
                  Tenure (months) <span className="text-danger">*</span>
                </label>
                <input
                  id="deposit-tenure"
                  type="number"
                  step="1"
                  min="1"
                  max="600"
                  className="form-input"
                  placeholder="e.g. 12"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  required
                />
              </div>
            </div>
            <span className="input-hint">
              Current value grows automatically at this rate (quarterly compounding). No monthly check-in needed.
            </span>
          </>
        ) : (
          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="current-value" className="form-label">
                Current Value (₹) <span className="text-danger">*</span>
              </label>
              <div className="input-currency-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  id="current-value"
                  type="number"
                  step="any"
                  min="0"
                  className="form-input currency-input"
                  placeholder="0.00"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="annual-return" className="form-label">
                Expected Return (% / yr)
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
              <span className="input-hint">Default is profile baseline (8%)</span>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="monthly-sip" className="form-label">
                Monthly SIP (₹)
              </label>
              <input
                id="monthly-sip"
                type="number"
                step="any"
                min="0"
                className="form-input"
                placeholder="Optional"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="asset-liquidity" className="form-label">
              Liquidity Profile
            </label>
            <select
              id="asset-liquidity"
              className="form-select"
              value={liquidity}
              onChange={(e) => setLiquidity(e.target.value as AssetLiquidity)}
            >
              <option value="liquid">Liquid (Readily convertible cash / stocks)</option>
              <option value="locked">Locked (PPF, EPF, Real Estate, Term FD)</option>
              <option value="restricted">Restricted (Lock-in period / exit penalty)</option>
            </select>
          </div>

          <div className="form-group flex-1 checkbox-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '18px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isNonInvestable ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={includedInFireCorpus}
                disabled={isNonInvestable}
                onChange={(e) => setIncludedInFireCorpus(e.target.checked)}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Include in FIRE Corpus
              </span>
            </label>
            {isNonInvestable && (
              <span className="input-hint hint-warning" style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>
                Non-investable assets cannot count toward FIRE corpus.
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="asset-notes" className="form-label">
            Notes (Optional)
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

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : assetToEdit ? 'Save Changes' : 'Record Asset'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
