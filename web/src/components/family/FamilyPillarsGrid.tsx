import React from 'react';
import type { FamilyFMI } from '../../types';
import { getFmiColor } from '../../utils/familyFormatters';
import { PiggyBank, Scale, Activity } from 'lucide-react';

export interface FamilyPillarsGridProps {
  fmi: FamilyFMI;
}

export const FamilyPillarsGrid: React.FC<FamilyPillarsGridProps> = ({ fmi }) => {
  const d1 = fmi?.pillars?.D1_savingDiscipline;
  const d2 = fmi?.pillars?.D2_spendingControl;
  const d3 = fmi?.pillars?.D3_behavioralRisk;

  const pillars = [
    {
      id: 'd1',
      name: 'Saving Discipline',
      weightLabel: '40% Weight',
      score: Math.round(d1?.score ?? 0),
      detail: d1?.detail || 'Evaluates household savings rate and investment consistency.',
      icon: PiggyBank,
    },
    {
      id: 'd2',
      name: 'Spending Control',
      weightLabel: '30% Weight',
      score: Math.round(d2?.score ?? 0),
      detail: d2?.detail || 'Evaluates essential versus discretionary spending balance.',
      icon: Scale,
    },
    {
      id: 'd3',
      name: 'Behavioral Stability', // Mandatory requirement 10: Use "Behavioral Stability"
      weightLabel: '30% Weight',
      score: Math.round(d3?.score ?? 0),
      detail: d3?.detail || 'Detects anomalies, late-night spending, and food spikes.',
      icon: Activity,
    },
  ];

  return (
    <div className="family-pillars-section" role="region" aria-label="Family FMI Pillars">
      <div className="family-section-header">
        <div>
          <h3 className="family-section-title">Household Discipline Pillars</h3>
          <p className="family-section-subtitle">
            Three deterministic pillars assessing combined financial health without inspecting individual transactions.
          </p>
        </div>
      </div>

      <div className="family-pillars-grid">
        {pillars.map((pillar) => {
          const color = getFmiColor(pillar.score);
          const clamped = Math.min(100, Math.max(0, pillar.score));
          const IconComponent = pillar.icon;

          return (
            <div key={pillar.id} className="family-pillar-card">
              <div className="family-pillar-top">
                <div className="family-pillar-title-wrap">
                  <div className="family-pillar-icon-badge" style={{ color }}>
                    <IconComponent size={18} />
                  </div>
                  <div>
                    <h4 className="family-pillar-name">{pillar.name}</h4>
                    <span className="family-pillar-weight">{pillar.weightLabel}</span>
                  </div>
                </div>

                <div className="family-pillar-score-wrap">
                  <span className="family-pillar-score" style={{ color }}>
                    {pillar.score}
                  </span>
                  <span className="family-pillar-denom">/100</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="family-pillar-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`${pillar.name} score ${pillar.score} out of 100`}>
                <div
                  className="family-pillar-fill"
                  style={{
                    width: `${clamped}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              <p className="family-pillar-detail">{pillar.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
