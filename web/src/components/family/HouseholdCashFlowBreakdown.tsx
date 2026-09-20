import React from 'react';
import type { FamilyTypeBreakdown } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface HouseholdCashFlowBreakdownProps {
  typeBreakdown?: FamilyTypeBreakdown | null;
}

export const HouseholdCashFlowBreakdown: React.FC<HouseholdCashFlowBreakdownProps> = ({
  typeBreakdown,
}) => {
  const needAmount = typeBreakdown?.need?.amount ?? 0;
  const needPct = typeBreakdown?.need?.percentageOfOutflow ?? 0;

  const wantAmount = typeBreakdown?.want?.amount ?? 0;
  const wantPct = typeBreakdown?.want?.percentageOfOutflow ?? 0;

  const investAmount = typeBreakdown?.investment?.amount ?? 0;
  const investPct = typeBreakdown?.investment?.percentageOfOutflow ?? 0;

  const total = needAmount + wantAmount + investAmount;

  return (
    <div className="household-cashflow-card" role="region" aria-label="Household Outflow Composition">
      <div className="family-section-header">
        <div>
          <h3 className="family-section-title">Outflow Composition by Type</h3>
          <p className="family-section-subtitle">
            Essential Needs, Discretionary Wants, and Wealth Investments.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="household-zero-data">
          <p>No household spending or investment activity recorded for this period.</p>
        </div>
      ) : (
        <>
          {/* Proportional Segmented Progress Bar */}
          <div className="household-type-bar" role="img" aria-label={`Needs: ${needPct}%, Wants: ${wantPct}%, Investments: ${investPct}%`}>
            <div
              className="household-type-segment need"
              style={{ width: `${Math.max(1, needPct)}%` }}
              title={`Needs: ${needPct}%`}
            />
            <div
              className="household-type-segment want"
              style={{ width: `${Math.max(1, wantPct)}%` }}
              title={`Wants: ${wantPct}%`}
            />
            <div
              className="household-type-segment investment"
              style={{ width: `${Math.max(1, investPct)}%` }}
              title={`Investments: ${investPct}%`}
            />
          </div>

          {/* Breakdown Rows */}
          <div className="household-type-legend-grid">
            <div className="household-type-legend-card need">
              <div className="household-type-legend-indicator" />
              <div className="household-type-legend-info">
                <span className="household-type-name">Needs (Essential)</span>
                <span className="household-type-amount">{formatCurrencyINR(needAmount)}</span>
              </div>
              <span className="household-type-pct">{needPct}%</span>
            </div>

            <div className="household-type-legend-card want">
              <div className="household-type-legend-indicator" />
              <div className="household-type-legend-info">
                <span className="household-type-name">Wants (Discretionary)</span>
                <span className="household-type-amount">{formatCurrencyINR(wantAmount)}</span>
              </div>
              <span className="household-type-pct">{wantPct}%</span>
            </div>

            <div className="household-type-legend-card investment">
              <div className="household-type-legend-indicator" />
              <div className="household-type-legend-info">
                <span className="household-type-name">Investments (Flow)</span>
                <span className="household-type-amount">{formatCurrencyINR(investAmount)}</span>
              </div>
              <span className="household-type-pct">{investPct}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
