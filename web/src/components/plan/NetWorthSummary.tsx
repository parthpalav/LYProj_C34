import React from 'react';
import { TrendingUp, ArrowDown, Flame, Shield } from 'lucide-react';

interface NetWorthSummaryProps {
  knownNetWorth: number;
  totalAssetValue: number;
  totalLiabilities: number;
  operationalCash: number;
  liquidBuffer: number;
  fireInvestableCorpus: number;
}

function formatINR(val: number): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  return `${isNeg ? '-' : ''}₹${abs.toLocaleString('en-IN')}`;
}

export const NetWorthSummary: React.FC<NetWorthSummaryProps> = ({
  knownNetWorth,
  totalAssetValue,
  totalLiabilities,
  liquidBuffer,
  fireInvestableCorpus,
}) => {
  return (
    <div className="plan-nw-summary">
      {/* Hero Net Worth Card */}
      <div className="plan-nw-hero">
        <span className="plan-nw-hero-eyebrow">Authoritative Balance Sheet</span>
        <h2 className="plan-nw-hero-label">Known Net Worth</h2>
        <div className="plan-nw-hero-value">{formatINR(knownNetWorth)}</div>
        <div className="plan-nw-hero-breakdown">
          <span className="plan-nw-breakdown-item">
            <TrendingUp size={14} aria-hidden="true" />
            Assets <strong>{formatINR(totalAssetValue)}</strong>
          </span>
          <span className="plan-nw-breakdown-sep" aria-hidden="true">•</span>
          <span className="plan-nw-breakdown-item plan-nw-breakdown-liab">
            <ArrowDown size={14} aria-hidden="true" />
            Liabilities <strong>{totalLiabilities > 0 ? formatINR(totalLiabilities) : '₹0'}</strong>
          </span>
        </div>
      </div>

      {/* Auxiliary Metrics */}
      <div className="plan-nw-aux-grid">
        <div className="plan-nw-aux-card">
          <div className="plan-nw-aux-icon plan-nw-aux-icon--assets">
            <TrendingUp size={18} />
          </div>
          <div className="plan-nw-aux-body">
            <span className="plan-nw-aux-label">Total Assets</span>
            <span className="plan-nw-aux-value">{formatINR(totalAssetValue)}</span>
            <span className="plan-nw-aux-hint">Recorded financial holdings</span>
          </div>
        </div>

        <div className="plan-nw-aux-card">
          <div className="plan-nw-aux-icon plan-nw-aux-icon--liab">
            <ArrowDown size={18} />
          </div>
          <div className="plan-nw-aux-body">
            <span className="plan-nw-aux-label">Total Liabilities</span>
            <span className="plan-nw-aux-value plan-nw-aux-value--danger">
              {totalLiabilities > 0 ? `-${formatINR(totalLiabilities)}` : '₹0'}
            </span>
            <span className="plan-nw-aux-hint">Outstanding principal balance</span>
          </div>
        </div>

        <div className="plan-nw-aux-card">
          <div className="plan-nw-aux-icon plan-nw-aux-icon--fire">
            <Flame size={18} />
          </div>
          <div className="plan-nw-aux-body">
            <span className="plan-nw-aux-label">FIRE Investable</span>
            <span className="plan-nw-aux-value">{formatINR(fireInvestableCorpus)}</span>
            <span className="plan-nw-aux-hint">Allocated toward retirement</span>
          </div>
        </div>

        <div className="plan-nw-aux-card">
          <div className="plan-nw-aux-icon plan-nw-aux-icon--shield">
            <Shield size={18} />
          </div>
          <div className="plan-nw-aux-body">
            <span className="plan-nw-aux-label">Liquid Emergency Buffer</span>
            <span className="plan-nw-aux-value">{formatINR(liquidBuffer)}</span>
            <span className="plan-nw-aux-hint">Readily accessible reserves</span>
          </div>
        </div>
      </div>
    </div>
  );
};
