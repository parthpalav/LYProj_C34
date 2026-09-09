import React from 'react';
import type { FMIResponse } from '../../types';

export interface FmiScoreHeroProps {
  fmi: FMIResponse | null;
  deltaSummary?: {
    hasComparison: boolean;
    scoreDelta: number;
    previousScore: number | null;
  } | null;
}

export const FmiScoreHero: React.FC<FmiScoreHeroProps> = ({ fmi, deltaSummary }) => {
  if (!fmi) return null;

  const score = fmi.score ?? fmi.FMI ?? 0;
  const label = fmi.fmiLabel || (score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Attention');

  // SVG Radial Ring Metrics
  const radius = 42;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s >= 80) return '#10b981';
    if (s >= 65) return '#2563eb';
    if (s >= 45) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreColorClass = (s: number) => {
    if (s >= 80) return 'text-emerald';
    if (s >= 65) return 'text-blue';
    if (s >= 45) return 'text-amber';
    return 'text-danger';
  };

  return (
    <div className="insights-hero-card fmi-hero-card">
      <div className="hero-content-row">
        <div className="hero-score-cluster">
          {/* Circular SVG Score Ring */}
          <div className="score-radial-ring" aria-label={`FMI Score: ${score} out of 100, rated ${label}`}>
            <svg width="104" height="104" viewBox="0 0 104 104" className="score-ring-svg">
              {/* Background Track */}
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="transparent"
                stroke="var(--bg-surface-subtle, #f1f5f9)"
                strokeWidth={strokeWidth}
              />
              {/* Animated Progress Fill */}
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="transparent"
                stroke={getScoreColor(score)}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 52 52)"
                style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
              />
            </svg>
            <div className="score-radial-inner">
              <span className={`hero-score-value font-black tabular-nums ${getScoreColorClass(score)}`}>
                {score}
              </span>
              <span className="hero-score-denom text-tertiary">/100</span>
            </div>
          </div>

          <div className="hero-meta">
            <div className="hero-label-row">
              <span className="overview-context-badge">DIAGNOSTIC COMPOSITE</span>
              <h2 className="hero-title">Financial Momentum Index (FMI)</h2>
              <div className="hero-fmi-badge-row">
                <span className="badge-fmi-label">{label}</span>
                {deltaSummary?.hasComparison && (
                  <span className={`fmi-delta-pill ${deltaSummary.scoreDelta >= 0 ? 'delta-pos' : 'delta-neg'} tabular-nums`}>
                    {deltaSummary.scoreDelta >= 0 ? `+${deltaSummary.scoreDelta}` : deltaSummary.scoreDelta} pts from prior snapshot
                  </span>
                )}
              </div>
            </div>
            <p className="hero-subtitle text-secondary text-sm">
              Deterministic composite financial health measurement evaluated across saving, spending control, and behavioral risk discipline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
