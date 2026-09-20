import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, Lightbulb } from 'lucide-react';
import type { FamilyDashboard } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { getFmiColor, getFmiBadgeBg } from '../../utils/familyFormatters';

export interface FamilyOverviewCardProps {
  dashboard: FamilyDashboard;
}

export const FamilyOverviewCard: React.FC<FamilyOverviewCardProps> = ({ dashboard }) => {
  const fmi = dashboard?.fmi;
  const fmiScore = Math.round(fmi?.score ?? 0);
  const fmiLabel = fmi?.fmiLabel || 'Evaluating';
  const color = getFmiColor(fmiScore);
  const badgeBg = getFmiBadgeBg(fmiScore);

  const memberCount = dashboard?.family?.memberCount || dashboard?.family?.members?.length || 2;
  const firstInsight = fmi?.insights && fmi.insights.length > 0 ? fmi.insights[0] : null;

  const effectiveIncome = dashboard?.income?.effectiveMonthlyIncome ?? 0;
  const householdSpending = dashboard?.spending?.totalNonInvestment ?? 0; // Need + Want only
  const investedThisMonth = dashboard?.investments?.monthlyFlow ?? 0;
  const netCash = dashboard?.cashFlow?.netCashPosition ?? 0;

  return (
    <div className="family-overview-card" role="region" aria-label="Household Overview">
      {/* ── Card Header ─────────────────────────────────── */}
      <div className="family-overview-header">
        <div className="family-overview-header-left">
          <div className="family-overview-icon-badge">
            <Users size={18} />
          </div>
          <div>
            <h3 className="family-overview-title">Household Overview</h3>
            <span className="family-overview-subtitle">Combined view of your Family’s finances</span>
          </div>
        </div>

        <div className="family-overview-member-pill">
          <Users size={13} />
          <span>{memberCount} Members</span>
        </div>
      </div>

      {/* ── Household FMI Mini-Widget ───────────────────── */}
      <div className="family-overview-fmi-box">
        <div className="family-overview-fmi-left">
          <div className="family-overview-fmi-label-row">
            <span className="family-overview-fmi-label">Household FMI</span>
            <span
              className="family-overview-fmi-badge"
              style={{
                color,
                backgroundColor: badgeBg,
                borderColor: `${color}40`,
              }}
            >
              {fmiLabel}
            </span>
          </div>
          <p className="family-overview-fmi-desc">
            Based on combined household saving, spending and behavioral patterns.
          </p>
        </div>

        <div className="family-overview-fmi-score-wrap">
          <span className="family-overview-fmi-score" style={{ color }}>
            {fmiScore}
          </span>
          <span className="family-overview-fmi-denom">/ 100</span>
        </div>
      </div>

      {/* ── 2x2 Household Financial Metrics Grid ────────── */}
      <div className="family-overview-metrics-grid">
        <div className="family-overview-metric-cell">
          <span className="family-overview-metric-label">Household Income</span>
          <span className="family-overview-metric-val">{formatCurrencyINR(effectiveIncome)}</span>
          <span className="family-overview-metric-sub">Effective monthly</span>
        </div>

        <div className="family-overview-metric-cell">
          <span className="family-overview-metric-label">Household Spending</span>
          <span className="family-overview-metric-val warning">{formatCurrencyINR(householdSpending)}</span>
          <span className="family-overview-metric-sub">Need + Want spend</span>
        </div>

        <div className="family-overview-metric-cell">
          <span className="family-overview-metric-label">Invested This Month</span>
          <span className="family-overview-metric-val success">{formatCurrencyINR(investedThisMonth)}</span>
          <span className="family-overview-metric-sub">
            {dashboard?.investments?.investmentRatePercent != null
              ? `${dashboard.investments.investmentRatePercent}% of income`
              : 'Monthly flow'}
          </span>
        </div>

        <div className="family-overview-metric-cell">
          <span className="family-overview-metric-label">Net Cash Position</span>
          <span className={`family-overview-metric-val ${netCash >= 0 ? 'success' : 'danger'}`}>
            {formatCurrencyINR(netCash, { showSign: true })}
          </span>
          <span className="family-overview-metric-sub">Monthly surplus</span>
        </div>
      </div>

      {/* ── Household Insight Preview (at most 1) ────────── */}
      {firstInsight && (
        <div className="family-overview-insight-banner">
          <Lightbulb size={15} className="family-overview-insight-icon" />
          <p className="family-overview-insight-text">{firstInsight}</p>
        </div>
      )}

      {/* ── Action Footer Linking to Canonical /app/family ─ */}
      <div className="family-overview-footer">
        <Link to="/app/family" className="family-overview-cta">
          <span>View Family Details</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};
