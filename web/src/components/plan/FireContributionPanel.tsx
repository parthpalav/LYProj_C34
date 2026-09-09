import React from 'react';
import { Info } from 'lucide-react';

interface FireContributionPanelProps {
  requiredMonthlyContribution: number | null;
  currentMonthlyContribution: number;
  contributionGap: number | null;
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const FireContributionPanel: React.FC<FireContributionPanelProps> = ({
  requiredMonthlyContribution,
  currentMonthlyContribution,
  contributionGap,
}) => {
  const hasGap = contributionGap !== null && contributionGap > 0;

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header">
        <h3 className="plan-section-title">Contribution Requirements</h3>
        <p className="plan-section-subtitle">
          Monthly savings requirements modeled to fund the estimated FIRE target
        </p>
      </div>

      <div className="plan-contrib-grid">
        <div className="plan-contrib-card">
          <span className="plan-contrib-label">Required Monthly Investment</span>
          <span className="plan-contrib-value plan-contrib-value--primary">
            {formatINR(requiredMonthlyContribution)}
          </span>
          <span className="plan-contrib-hint">Nominal flat monthly requirement to reach target</span>
        </div>

        <div className="plan-contrib-card">
          <span className="plan-contrib-label">Observed Monthly Contribution</span>
          <span className="plan-contrib-value">
            {formatINR(currentMonthlyContribution)}
          </span>
          <span className="plan-contrib-hint">Based on recent observed investment cash flows</span>
        </div>

        <div className={`plan-contrib-card ${hasGap ? 'plan-contrib-card--warning' : 'plan-contrib-card--ok'}`}>
          <span className="plan-contrib-label">Monthly Contribution Gap</span>
          <span className="plan-contrib-value">
            {hasGap ? `-${formatINR(contributionGap)}` : '₹0 (Fully Funded)'}
          </span>
          <span className="plan-contrib-hint">
            {hasGap
              ? 'Additional monthly investment modeled to meet retirement corpus'
              : 'Current contribution satisfies modeled requirement'}
          </span>
        </div>
      </div>

      <div className="plan-policy-note">
        <Info size={16} className="plan-policy-note-icon" />
        <p className="plan-policy-note-text">
          Under current assumptions, the model estimates that maintaining a regular investment of{' '}
          <strong>{formatINR(requiredMonthlyContribution)}/month</strong> aligns with reaching the estimated FIRE target at retirement. Projections assume steady market returns and long-term discipline.
        </p>
      </div>
    </div>
  );
};
