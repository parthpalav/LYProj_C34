import React from 'react';

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
  operationalCash,
  liquidBuffer,
  fireInvestableCorpus,
}) => {
  return (
    <div className="net-worth-summary-grid">
      {/* Hero Net Worth Card */}
      <div className="net-worth-hero-card">
        <div className="net-worth-hero-header">
          <span className="net-worth-hero-badge">Authoritative Balance Sheet</span>
          <span className="net-worth-hero-subtitle">Real-time financial position</span>
        </div>
        <h2 className="net-worth-hero-title">Net Worth</h2>
        <div className="net-worth-hero-value">{formatINR(knownNetWorth)}</div>
        <div className="net-worth-hero-meta">
          <span>Assets: <strong>{formatINR(totalAssetValue)}</strong></span>
          <span className="meta-sep">•</span>
          <span>Liabilities: <strong>{formatINR(totalLiabilities)}</strong></span>
        </div>
      </div>

      {/* Auxiliary Metrics Grid */}
      <div className="net-worth-aux-grid">
        <div className="net-worth-aux-card">
          <div className="aux-card-icon">💰</div>
          <div className="aux-card-content">
            <span className="aux-card-label">Total Assets</span>
            <span className="aux-card-value">{formatINR(totalAssetValue)}</span>
            <span className="aux-card-hint">Recorded financial holdings</span>
          </div>
        </div>

        <div className="net-worth-aux-card">
          <div className="aux-card-icon">📉</div>
          <div className="aux-card-content">
            <span className="aux-card-label">Total Liabilities</span>
            <span className="aux-card-value liabilities-text">
              {totalLiabilities > 0 ? `-${formatINR(totalLiabilities)}` : '₹0'}
            </span>
            <span className="aux-card-hint">Outstanding principal balance</span>
          </div>
        </div>

        <div className="net-worth-aux-card">
          <div className="aux-card-icon">🔥</div>
          <div className="aux-card-content">
            <span className="aux-card-label">FIRE Investable</span>
            <span className="aux-card-value">{formatINR(fireInvestableCorpus)}</span>
            <span className="aux-card-hint">Allocated toward retirement</span>
          </div>
        </div>

        <div className="net-worth-aux-card">
          <div className="aux-card-icon">🛡️</div>
          <div className="aux-card-content">
            <span className="aux-card-label">Liquid Emergency Buffer</span>
            <span className="aux-card-value">{formatINR(liquidBuffer)}</span>
            <span className="aux-card-hint">Readily accessible reserves</span>
          </div>
        </div>

        <div className="net-worth-aux-card">
          <div className="aux-card-icon">🏦</div>
          <div className="aux-card-content">
            <span className="aux-card-label">Operational Cash</span>
            <span className="aux-card-value">{formatINR(operationalCash)}</span>
            <span className="aux-card-hint">Uninvested wallet/account balance</span>
          </div>
        </div>
      </div>
    </div>
  );
};
