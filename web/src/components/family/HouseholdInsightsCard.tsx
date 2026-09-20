import React from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';

export interface HouseholdInsightsCardProps {
  insights?: string[] | null;
}

export const HouseholdInsightsCard: React.FC<HouseholdInsightsCardProps> = ({ insights }) => {
  const items = insights || [];

  return (
    <div className="household-insights-card" role="region" aria-label="Household Insights">
      <div className="family-section-header">
        <div className="family-section-header-row">
          <div className="family-section-icon-wrap amber">
            <Lightbulb size={18} />
          </div>
          <div>
            <h3 className="family-section-title">Household Insights</h3>
            <p className="family-section-subtitle">
              Deterministic behavioral observations based on combined household activity.
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="household-zero-data">
          <p>Household insights will appear as more financial activity is recorded.</p>
        </div>
      ) : (
        <div className="household-insights-list">
          {items.map((insight, idx) => (
            <div key={idx} className="household-insight-item">
              <div className="household-insight-bullet">
                <Sparkles size={14} className="household-insight-sparkle" />
              </div>
              <p className="household-insight-text">{insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
