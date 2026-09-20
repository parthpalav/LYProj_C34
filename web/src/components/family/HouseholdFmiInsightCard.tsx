import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import type { FamilyDashboard } from '../../types';
import { getFmiColor, getFmiBadgeBg } from '../../utils/familyFormatters';

export interface HouseholdFmiInsightCardProps {
  dashboard: FamilyDashboard;
}

export const HouseholdFmiInsightCard: React.FC<HouseholdFmiInsightCardProps> = ({ dashboard }) => {
  const fmi = dashboard?.fmi;
  const fmiScore = Math.round(fmi?.score ?? 0);
  const fmiLabel = fmi?.fmiLabel || 'Evaluating';
  const color = getFmiColor(fmiScore);
  const badgeBg = getFmiBadgeBg(fmiScore);
  const memberCount = dashboard?.family?.memberCount || dashboard?.family?.members?.length || 2;

  return (
    <div className="household-fmi-insight-card" role="region" aria-label="Household Financial Maturity">
      <div className="household-fmi-insight-header">
        <div className="household-fmi-insight-title-row">
          <div className="household-fmi-insight-icon">
            <Users size={16} />
          </div>
          <span className="household-fmi-insight-title">Household Financial Maturity</span>
        </div>
        <span className="household-fmi-insight-members">{memberCount} Members</span>
      </div>

      <div className="household-fmi-insight-body">
        <div className="household-fmi-insight-score-row">
          <div className="household-fmi-insight-score" style={{ color }}>
            {fmiScore}
            <span className="household-fmi-insight-denom">/ 100</span>
          </div>
          <span
            className="household-fmi-insight-badge"
            style={{
              color,
              backgroundColor: badgeBg,
              borderColor: `${color}40`,
            }}
          >
            {fmiLabel}
          </span>
        </div>
        <p className="household-fmi-insight-desc">
          Evaluates combined household saving and spending discipline. Personal FMI remains independent.
        </p>
      </div>

      <div className="household-fmi-insight-footer">
        <Link to="/app/family" className="household-fmi-insight-link">
          <span>View Household Details</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};
