import React from 'react';

interface FireHeroSummaryProps {
  targetFireCorpus: number;
  currentFireCorpus: number;
  currentAge: number | null;
  targetRetirementAge: number | null;
  projectedFireAge: number | null;
  isFireReached: boolean;
  projectedCorpusAtRetirement: number | null;
  fireProgressPercentage: number;
}

function formatINR(val: number): string {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const FireHeroSummary: React.FC<FireHeroSummaryProps> = ({
  targetFireCorpus,
  currentFireCorpus,
  currentAge,
  targetRetirementAge,
  projectedFireAge,
  isFireReached,
  projectedCorpusAtRetirement,
  fireProgressPercentage,
}) => {
  return (
    <div className="fire-hero-container">
      <div className="fire-hero-header">
        <div>
          <span className="fire-hero-badge">Financial Independence, Retire Early</span>
          <h2 className="fire-hero-title">FIRE Cockpit</h2>
        </div>
        <div className="fire-status-pill">
          {isFireReached ? (
            <span className="pill-success">🎯 On Track for Target</span>
          ) : (
            <span className="pill-warning">⚡ Saving Gap Identified</span>
          )}
        </div>
      </div>

      <div className="fire-hero-main-grid">
        {/* Target FIRE Corpus */}
        <div className="fire-hero-stat">
          <span className="hero-stat-label">Target FIRE Corpus</span>
          <span className="hero-stat-value primary-gradient-text">{formatINR(targetFireCorpus)}</span>
          <span className="hero-stat-desc">
            Estimated capital required for sustainable withdrawal
          </span>
        </div>

        {/* Current Investable Corpus */}
        <div className="fire-hero-stat">
          <span className="hero-stat-label">Current Investable Corpus</span>
          <span className="hero-stat-value">{formatINR(currentFireCorpus)}</span>
          <span className="hero-stat-desc">
            Qualified assets allocated to FIRE portfolio
          </span>
        </div>

        {/* Projected Corpus at Retirement */}
        <div className="fire-hero-stat">
          <span className="hero-stat-label">Projected Corpus at Age {targetRetirementAge ?? 60}</span>
          <span className="hero-stat-value">
            {projectedCorpusAtRetirement !== null ? formatINR(projectedCorpusAtRetirement) : '—'}
          </span>
          <span className="hero-stat-desc">
            Under base nominal return and inflation assumptions
          </span>
        </div>

        {/* Projected FIRE Age */}
        <div className="fire-hero-stat">
          <span className="hero-stat-label">Projected FIRE Age</span>
          <span className="hero-stat-value accent-text">
            {projectedFireAge !== null ? `${projectedFireAge.toFixed(1)} yrs` : 'Not in horizon'}
          </span>
          <span className="hero-stat-desc">
            {currentAge !== null && targetRetirementAge !== null
              ? `Current age: ${currentAge} | Target age: ${targetRetirementAge}`
              : 'Based on current savings trajectory'}
          </span>
        </div>
      </div>

      {/* FIRE Progress Track */}
      <div className="fire-progress-card">
        <div className="fire-progress-header">
          <span>Corpus Funding Progress</span>
          <span><strong>{fireProgressPercentage}%</strong> of target achieved</span>
        </div>
        <div className="fire-progress-track">
          <div
            className="fire-progress-fill"
            style={{ width: `${fireProgressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
