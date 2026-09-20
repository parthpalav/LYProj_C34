import React from 'react';
import type { FamilyFMI } from '../../types';
import { getFmiColor, getFmiBadgeBg } from '../../utils/familyFormatters';

export interface FamilyFmiHeroProps {
  fmi: FamilyFMI;
}

export const FamilyFmiHero: React.FC<FamilyFmiHeroProps> = ({ fmi }) => {
  const score = Math.round(fmi?.score ?? 0);
  const color = getFmiColor(score);
  const badgeBg = getFmiBadgeBg(score);
  const label = fmi?.fmiLabel || 'Evaluating';

  // SVG Progress Ring calculations (radius = 54, circumference = 2 * PI * 54 = ~339.29)
  const radius = 54;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="family-fmi-hero-card" role="region" aria-label="Family Financial Maturity Hero">
      <div className="family-fmi-hero-content">
        <div className="family-fmi-hero-left">
          <div className="family-fmi-hero-tag">Household Financial Health</div>
          <h2 className="family-fmi-hero-title">Family Financial Maturity</h2>
          <p className="family-fmi-hero-desc">
            Based on your household’s combined saving, spending and behavioral patterns.
            This metric reflects pooled stability without blending individual accounts.
          </p>
          <div className="family-fmi-badge-wrap">
            <span
              className="family-fmi-status-pill"
              style={{
                color,
                backgroundColor: badgeBg,
                borderColor: `${color}40`,
              }}
            >
              {label}
            </span>
            <span className="family-fmi-term-note">
              Financial Maturity Index
            </span>
          </div>
        </div>

        <div className="family-fmi-hero-right">
          <div className="family-fmi-gauge-container">
            <svg
              className="family-fmi-gauge-svg"
              width="140"
              height="140"
              viewBox="0 0 140 140"
              aria-hidden="true"
            >
              {/* Background Track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="var(--border-default, #e2e8f0)"
                strokeWidth={strokeWidth}
              />
              {/* Animated Progress Arc */}
              <circle
                className="family-fmi-gauge-progress"
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
              />
            </svg>

            <div className="family-fmi-gauge-center">
              <span className="family-fmi-gauge-number" style={{ color }}>
                {score}
              </span>
              <span className="family-fmi-gauge-scale">/ 100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
