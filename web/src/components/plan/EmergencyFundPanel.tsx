import React from 'react';

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
    <div className="emergency-liability-panel-grid">
      {/* Emergency Fund Card */}
      <div className="planning-panel-card">
        <div className="panel-card-header">
          <span className="panel-badge badge-emergency">Liquid Resilience</span>
          <h4 className="panel-card-title">Emergency Fund Buffer</h4>
        </div>

        <div className="panel-metrics-grid">
          <div>
            <span className="pmetric-label">Target Buffer ({targetMonths} Months)</span>
            <span className="pmetric-value">{formatINR(targetAmount)}</span>
          </div>
          <div>
            <span className="pmetric-label">Current Liquid Reserves</span>
            <span className="pmetric-value">{formatINR(currentLiquid)}</span>
          </div>
          <div>
            <span className="pmetric-label">Runway Coverage</span>
            <span className={`pmetric-value ${isAdequate ? 'text-success' : 'text-warning'}`}>
              {coverageMonths !== null ? `${coverageMonths.toFixed(1)} months` : '—'}
            </span>
          </div>
        </div>

        <div className="panel-footer-note">
          {fundingGap > 0 ? (
            <span className="note-deficit">
              ⚠️ Gap of {formatINR(fundingGap)} to reach recommended {targetMonths}-month safety runway.
            </span>
          ) : (
            <span className="note-funded">
              ✅ Emergency reserve satisfies the {targetMonths}-month essential expense buffer policy.
            </span>
          )}
        </div>
      </div>

      {/* Liability Impact / Overhang Card (Correction #8) */}
      {liabilityOverhang !== null && (
        <div className="planning-panel-card liability-overhang-card">
          <div className="panel-card-header">
            <span className="panel-badge badge-liability">Debt Service Impact</span>
            <h4 className="panel-card-title">Liability Overhang on FIRE Target</h4>
          </div>

          <div className="overhang-body">
            <div className="overhang-stat">
              <span className="overhang-label">Added to FIRE Capital Requirement</span>
              <span className="overhang-value">+{formatINR(liabilityOverhang)}</span>
            </div>
            <p className="overhang-explanation">
              The model accounts for active long-term obligations with maturities extending past your target retirement age, ensuring debt amortization is fully capitalized without depleting your post-retirement living buffer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
