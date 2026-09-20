import React from 'react';
import type { FamilyDashboard } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import {
  Wallet,
  ShoppingBag,
  TrendingUp,
  Percent,
  CircleDollarSign,
  Info,
} from 'lucide-react';

export interface HouseholdMetricsGridProps {
  dashboard: FamilyDashboard;
}

export const HouseholdMetricsGrid: React.FC<HouseholdMetricsGridProps> = ({ dashboard }) => {
  const effectiveIncome = dashboard?.income?.effectiveMonthlyIncome ?? 0;
  const householdSpending = dashboard?.spending?.totalNonInvestment ?? 0; // Need + Want (strictly excludes investment)
  const investedThisMonth = dashboard?.investments?.monthlyFlow ?? 0;
  const investmentRate = dashboard?.investments?.investmentRatePercent ?? 0;
  const netCash = dashboard?.cashFlow?.netCashPosition ?? 0;
  const totalOutflow = dashboard?.cashFlow?.totalOutflow ?? 0;

  const metrics = [
    {
      id: 'income',
      label: 'Combined Monthly Income',
      value: formatCurrencyINR(effectiveIncome),
      subtext: 'Effective pool (actual + declared)',
      icon: Wallet,
      color: 'var(--text-primary, #0f172a)',
    },
    {
      id: 'spending',
      label: 'Household Spending',
      value: formatCurrencyINR(householdSpending),
      subtext: 'Needs + Wants (excl. investments)',
      icon: ShoppingBag,
      color: 'var(--warning-text, #92400e)',
    },
    {
      id: 'invested',
      label: 'Invested This Month',
      value: formatCurrencyINR(investedThisMonth),
      subtext: 'Wealth & asset building flow',
      icon: TrendingUp,
      color: 'var(--success, #10b981)',
    },
    {
      id: 'rate',
      label: 'Investment Rate',
      value: `${investmentRate}%`,
      subtext: 'Of effective household income',
      icon: Percent,
      color: 'var(--accent-primary, #2563eb)',
    },
    {
      id: 'netcash',
      label: 'Net Cash Position',
      value: formatCurrencyINR(netCash, { showSign: true }),
      subtext: netCash >= 0 ? 'Monthly cash surplus' : 'Monthly deficit',
      icon: CircleDollarSign,
      color: netCash >= 0 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)',
    },
  ];

  return (
    <div className="household-metrics-section" role="region" aria-label="Household Financial Summary">
      <div className="family-section-header">
        <div>
          <h3 className="family-section-title">Household Financial Summary</h3>
          <p className="family-section-subtitle">
            Authoritative combined monthly totals reflecting pooled cash flow.
          </p>
        </div>
      </div>

      <div className="household-metrics-grid">
        {metrics.map((m) => {
          const IconComponent = m.icon;
          return (
            <div key={m.id} className="household-metric-card">
              <div className="household-metric-header">
                <span className="household-metric-label">{m.label}</span>
                <div className="household-metric-icon" style={{ color: m.color }}>
                  <IconComponent size={16} />
                </div>
              </div>
              <div className="household-metric-value" style={{ color: m.color }}>
                {m.value}
              </div>
              <div className="household-metric-subtext">{m.subtext}</div>
            </div>
          );
        })}
      </div>

      {/* Outflow vs Spending Transparency Sub-Banner */}
      <div className="household-outflow-banner">
        <Info size={16} className="household-outflow-icon" />
        <div className="household-outflow-text">
          Total Outflow: <strong>{formatCurrencyINR(totalOutflow)}</strong>
          <span className="household-outflow-sep">•</span>
          Household Spending (Need + Want): <strong>{formatCurrencyINR(householdSpending)}</strong>
          <span className="household-outflow-sep">•</span>
          Investments: <strong>{formatCurrencyINR(investedThisMonth)}</strong>
        </div>
      </div>
    </div>
  );
};
