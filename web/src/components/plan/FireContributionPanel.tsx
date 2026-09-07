import React from 'react';

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
    <div className="fire-contribution-container">
      <div className="contribution-header">
        <h3 className="contribution-title">Contribution Solvers & Required Savings</h3>
        <p className="contribution-subtitle">
          Authoritative monthly savings requirements to fully fund the estimated FIRE target
        </p>
      </div>

      <div className="contribution-metrics-grid">
        <div className="contrib-metric-card">
          <span className="contrib-metric-label">Required Monthly Investment</span>
          <span className="contrib-metric-value primary-color">
            {formatINR(requiredMonthlyContribution)}
          </span>
          <span className="contrib-metric-hint">Nominal flat monthly requirement to reach target</span>
        </div>

        <div className="contrib-metric-card">
          <span className="contrib-metric-label">Observed Monthly Contribution</span>
          <span className="contrib-metric-value">
            {formatINR(currentMonthlyContribution)}
          </span>
          <span className="contrib-metric-hint">Based on recent observed investment cash flows</span>
        </div>

        <div className={`contrib-metric-card ${hasGap ? 'card-warning' : 'card-success'}`}>
          <span className="contrib-metric-label">Monthly Contribution Gap</span>
          <span className="contrib-metric-value">
            {hasGap ? `-${formatINR(contributionGap)}` : '₹0 (Fully Funded)'}
          </span>
          <span className="contrib-metric-hint">
            {hasGap
              ? 'Additional monthly investment needed to meet retirement corpus'
              : 'Current contribution satisfies modeled requirement'}
          </span>
        </div>
      </div>

      <div className="contribution-policy-note">
        <span className="policy-note-icon">📌</span>
        <p className="policy-note-text">
          Under the current assumptions, the model projects that maintaining a regular investment of{' '}
          <strong>{formatINR(requiredMonthlyContribution)}/month</strong> aligns with reaching your target FIRE corpus at retirement. Projections assume steady market returns and long-term discipline.
        </p>
      </div>
    </div>
  );
};
