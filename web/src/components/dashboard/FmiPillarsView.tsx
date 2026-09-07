import React from 'react';
import type { FMIResponse } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';
import { EmptyState } from './EmptyState';
import { Activity, Sparkles } from 'lucide-react';

interface FmiPillarsViewProps {
  fmi?: FMIResponse | null;
}

export const FmiPillarsView: React.FC<FmiPillarsViewProps> = ({ fmi }) => {
  if (!fmi || typeof fmi.FMI !== 'number') {
    return (
      <EmptyState
        icon={Activity}
        message="FMI health scoring will activate once financial transactions and profile targets are logged."
      />
    );
  }

  const pillars = fmi.pillars;
  const d1 = pillars?.D1_savingDiscipline;
  const d2 = pillars?.D2_spendingControl;
  const d3 = pillars?.D3_behavioralRisk;

  // Real backend explanatory insights (max 3-4)
  const insights = Array.isArray(fmi.insights) ? fmi.insights.slice(0, 4) : [];

  return (
    <div className="fmi-view-container">
      {/* Pillar Breakdown */}
      <div className="fmi-pillars-list">
        {d1 && (
          <ProgressBar
            label="Saving Discipline"
            weightText="40% weight"
            value={d1.score}
            detail={d1.detail}
            color="#10b981"
          />
        )}

        {d2 && (
          <ProgressBar
            label="Spending Control"
            weightText="30% weight"
            value={d2.score}
            detail={d2.detail}
            color="#2563eb"
          />
        )}

        {d3 && (
          <ProgressBar
            label="Behavioral Risk"
            weightText="30% weight"
            value={d3.score}
            detail={d3.detail}
            color="#f59e0b"
          />
        )}
      </div>

      {/* Backend Explanatory Insights */}
      {insights.length > 0 && (
        <div className="fmi-insights-box">
          <div className="fmi-insights-header">
            <Sparkles size={15} className="fmi-insights-icon" aria-hidden="true" />
            <span className="fmi-insights-title">Why your FMI looks like this</span>
          </div>
          <ul className="fmi-insights-list">
            {insights.map((insight, idx) => (
              <li key={idx} className="fmi-insight-item">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
