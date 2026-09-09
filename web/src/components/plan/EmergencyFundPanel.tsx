import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

interface EmergencyFundPanelProps {
  emergencyFund: {
    targetMonths?: number;
    targetAmount?: number;
    knownLiquidEmergencyAssets?: number;
    coverageMonths?: number;
    fundingGap?: number;
  } | null;
  liabilityOverhang: number | null;
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const EmergencyFundPanel: React.FC<EmergencyFundPanelProps> = ({
  emergencyFund,
  liabilityOverhang,
}) => {
  const targetAmount = emergencyFund?.targetAmount ?? 0;
  const currentLiquid = emergencyFund?.knownLiquidEmergencyAssets ?? 0;
  const coverageMonths = emergencyFund?.coverageMonths ?? 0;
  const targetMonths = emergencyFund?.targetMonths ?? 6;
  const fundingGap = emergencyFund?.fundingGap ?? 0;

  const isAdequate = coverageMonths >= targetMonths;

  return (
    <div className="plan-emergency-grid">
      {/* Emergency Fund Card */}
      <div className="plan-surface-card">
        <div className="plan-section-header">
          <div className="plan-section-eyebrow plan-section-eyebrow--success">
            <Shield size={14} /> Liquid Resilience
          </div>
          <h4 className="plan-section-title">Emergency Fund Buffer</h4>
        </div>

        <div className="plan-emergency-metrics">
          <div>
            <span className="plan-emergency-label">Target Buffer ({targetMonths} Months)</span>
            <span className="plan-emergency-value">{formatINR(targetAmount)}</span>
          </div>
          <div>
            <span className="plan-emergency-label">Current Liquid Reserves</span>
            <span className="plan-emergency-value">{formatINR(currentLiquid)}</span>
          </div>
          <div>
            <span className="plan-emergency-label">Runway Coverage</span>
            <span className={`plan-emergency-value ${isAdequate ? 'plan-text-success' : 'plan-text-warning'}`}>
              {coverageMonths !== null ? `${coverageMonths.toFixed(1)} months` : '—'}
            </span>
          </div>
        </div>

        <div className="plan-emergency-footer">
          {fundingGap > 0 ? (
            <span className="plan-emergency-note plan-emergency-note--gap">
              <AlertTriangle size={14} />
              Gap of {formatINR(fundingGap)} to reach recommended {targetMonths}-month safety runway.
            </span>
          ) : (
            <span className="plan-emergency-note plan-emergency-note--ok">
              <Shield size={14} />
              Emergency reserve satisfies the {targetMonths}-month essential expense buffer policy.
            </span>
          )}
        </div>
      </div>

      {/* Liability Overhang — only when backend exposes the explanationFact */}
      {liabilityOverhang !== null && (
        <div className="plan-surface-card plan-overhang-card">
          <div className="plan-section-header">
            <div className="plan-section-eyebrow plan-section-eyebrow--warning">
              <AlertTriangle size={14} /> Debt Service Impact
            </div>
            <h4 className="plan-section-title">Liability Overhang on FIRE Target</h4>
          </div>

          <div className="plan-overhang-body">
            <div className="plan-overhang-stat">
              <span className="plan-overhang-label">Added to FIRE Capital Requirement</span>
              <span className="plan-overhang-value">+{formatINR(liabilityOverhang)}</span>
            </div>
            <p className="plan-overhang-explanation">
              The model accounts for active long-term obligations with maturities extending past your target retirement age, ensuring debt amortization is fully capitalized without depleting your post-retirement living buffer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
