import React from 'react';
import type { FamilyMemberBreakdown as Breakdown } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { getMemberInitials } from '../../utils/familyFormatters';

export interface FamilyMemberBreakdownProps {
  breakdown?: Breakdown | null;
  familyScore: number;
}

const MEMBER_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

export const FamilyMemberBreakdown: React.FC<FamilyMemberBreakdownProps> = ({ breakdown, familyScore }) => {
  if (!breakdown || breakdown.members.length === 0) return null;
  const { members } = breakdown;
  const positiveTotal = members.reduce((s, m) => s + Math.max(0, m.score.points), 0);

  return (
    <div className="household-category-card member-breakdown" role="region" aria-label="Member contributions">
      <div className="family-section-header">
        <div>
          <h3 className="family-section-title">Who contributes what</h3>
          <p className="family-section-subtitle">
            Each member's points of the family score ({familyScore}), worked out with Shapley values: the household is
            re-scored with and without each member and the differences are averaged. Points add up to the score.
            {!breakdown.viewerCanSeeAllAmounts && ' Only the family owner sees other members’ rupee amounts.'}
          </p>
        </div>
      </div>

      {positiveTotal > 0 && (
        <div className="member-breakdown-bar" role="img" aria-label={members.map((m) => `${m.name} ${m.score.points} points`).join(', ')}>
          {members.map((m, i) =>
            m.score.points > 0 ? (
              <div
                key={m.userId}
                className="member-breakdown-segment"
                style={{ width: `${(m.score.points / positiveTotal) * 100}%`, backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                title={`${m.name}: ${m.score.points} points`}
              />
            ) : null,
          )}
        </div>
      )}

      <div className="member-breakdown-list">
        {members.map((m, i) => (
          <div key={m.userId} className="member-breakdown-row">
            <div className="member-breakdown-head">
              <span className="member-breakdown-avatar" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                {getMemberInitials(m.name)}
              </span>
              <div className="member-breakdown-name-wrap">
                <span className="member-breakdown-name">
                  {m.name}
                  {m.isYou && <span className="member-breakdown-you"> (you)</span>}
                </span>
                <span className="member-breakdown-sub">
                  Saving {signed(m.score.pillars.D1)} · Spending {signed(m.score.pillars.D2)} · Behaviour {signed(m.score.pillars.D3)}
                </span>
              </div>
              <div className="member-breakdown-points">
                <strong>{signed(m.score.points)}</strong>
                <span>{m.score.pctOfScore}% of score</span>
              </div>
            </div>

            <dl className="member-breakdown-metrics">
              <Metric label="Income" pct={m.shares.incomePct} amount={m.amounts?.effectiveIncome} />
              <Metric label="Needs" pct={m.shares.needPct} amount={m.amounts?.need} />
              <Metric label="Wants" pct={m.shares.wantPct} amount={m.amounts?.want} />
              <Metric label="Invested" pct={m.shares.investmentPct} amount={m.amounts?.investment} />
              {m.amounts && (
                <div className="member-breakdown-metric">
                  <dt>Net cash</dt>
                  <dd>{formatCurrencyINR(m.amounts.netCash)}</dd>
                </div>
              )}
            </dl>

            {m.amounts && m.amounts.topCategories.length > 0 && (
              <p className="member-breakdown-cats">
                Top: {m.amounts.topCategories.map((c) => `${c.category} ${formatCurrencyINR(c.amount)}`).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; pct: number; amount?: number }> = ({ label, pct, amount }) => (
  <div className="member-breakdown-metric">
    <dt>{label}</dt>
    <dd>
      {pct}%{amount !== undefined && <span className="member-breakdown-amount"> · {formatCurrencyINR(amount)}</span>}
    </dd>
  </div>
);
