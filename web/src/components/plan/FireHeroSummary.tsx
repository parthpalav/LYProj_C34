import React from 'react';
import { Flame } from 'lucide-react';

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
  // isFireReached = projectedFire.reached from backend
  // This indicates whether the model projects the corpus reaching the FIRE target
  // within the savings horizon (via monthsToTarget projection)
  const statusText = isFireReached
    ? 'Projected corpus reaches target'
    : 'Projected corpus below target';

  return (
    <div className="plan-fire-hero">
      <div className="plan-fire-hero-header">
        <div>
          <span className="plan-fire-hero-eyebrow">
            <Flame size={14} /> FIRE — Financial Independence, Retire Early
          </span>
          <h2 className="plan-fire-hero-title">Retirement Projection</h2>
        </div>
        <div className={`plan-fire-status-pill ${isFireReached ? 'plan-fire-status-pill--reached' : 'plan-fire-status-pill--gap'}`}>
          {statusText}
        </div>
      </div>

      <div className="plan-fire-hero-grid">
        {/* Target FIRE Corpus */}
        <div className="plan-fire-stat">
          <span className="plan-fire-stat-label">Estimated FIRE Target</span>
          <span className="plan-fire-stat-value plan-fire-stat-value--primary">{formatINR(targetFireCorpus)}</span>
          <span className="plan-fire-stat-desc">
            Estimated capital required for sustainable withdrawal
          </span>
        </div>

        {/* Current Investable Corpus */}
        <div className="plan-fire-stat">
          <span className="plan-fire-stat-label">Current Investable Corpus</span>
          <span className="plan-fire-stat-value">{formatINR(currentFireCorpus)}</span>
          <span className="plan-fire-stat-desc">
            Qualified assets allocated to FIRE portfolio
          </span>
        </div>

        {/* Projected Corpus at Retirement */}
        <div className="plan-fire-stat">
          <span className="plan-fire-stat-label">Projected Corpus at Age {targetRetirementAge ?? 60}</span>
          <span className="plan-fire-stat-value">
            {projectedCorpusAtRetirement !== null ? formatINR(projectedCorpusAtRetirement) : '—'}
          </span>
          <span className="plan-fire-stat-desc">
            Under base nominal return and inflation assumptions
          </span>
        </div>

        {/* Projected FIRE Age — direct backend field */}
        <div className="plan-fire-stat">
          <span className="plan-fire-stat-label">Projected FIRE Age</span>
          <span className="plan-fire-stat-value plan-fire-stat-value--accent">
            {projectedFireAge !== null ? `${projectedFireAge.toFixed(1)} yrs` : 'Not in horizon'}
          </span>
          <span className="plan-fire-stat-desc">
            {currentAge !== null && targetRetirementAge !== null
              ? `Current age: ${currentAge} · Target age: ${targetRetirementAge}`
              : 'Based on current savings trajectory'}
          </span>
        </div>
      </div>

      {/* FIRE Progress Track */}
      <div className="plan-fire-progress">
        <div className="plan-fire-progress-header">
          <span>Corpus Funding Progress</span>
          <span><strong>{fireProgressPercentage}%</strong> of target achieved</span>
        </div>
        <div className="plan-fire-progress-track">
          <div
            className="plan-fire-progress-fill"
            style={{ '--fire-progress-width': `${fireProgressPercentage}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
};
