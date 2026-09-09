import React from 'react';
import type { FMIResponse } from '../../types';

export interface FmiPillarsGridProps {
  fmi: FMIResponse | null;
}

export const FmiPillarsGrid: React.FC<FmiPillarsGridProps> = ({ fmi }) => {
  const pillars = fmi?.pillars;

  if (!pillars) {
    return (
      <div className="insights-card">
        <p className="text-secondary text-sm">Detailed pillar data is currently unavailable.</p>
      </div>
    );
  }

  const d1 = pillars.D1_savingDiscipline || { score: 0, weight: 0.4, detail: 'Saving discipline' };
  const d2 = pillars.D2_spendingControl || { score: 0, weight: 0.3, detail: 'Spending control' };
  const d3 = pillars.D3_behavioralRisk || { score: 0, weight: 0.3, detail: 'Behavioral risk' };

  const getPillarFillClass = (score: number) => {
    if (score >= 80) return 'fill-emerald';
    if (score >= 60) return 'fill-blue';
    if (score >= 40) return 'fill-amber';
    return 'fill-danger';
  };

  return (
    <div className="fmi-pillars-grid">
      {/* D1 Saving Discipline */}
      <div className="fmi-pillar-card">
        <div className="pillar-header">
          <div className="pillar-title-group">
            <span className="pillar-code">D1</span>
            <span className="pillar-name font-semibold text-primary">Saving Discipline</span>
          </div>
          <span className="pillar-weight-badge text-xs font-semibold">40% Weight</span>
        </div>
        <div className="pillar-score-row">
          <span className="pillar-score font-bold text-primary tabular-nums">{d1.score}</span>
          <span className="text-tertiary text-xs">/100 score</span>
        </div>
        <div className="pillar-track" aria-hidden="true">
          <div
            className={`pillar-fill ${getPillarFillClass(d1.score)}`}
            style={{ width: `${Math.min(d1.score, 100)}%` }}
          />
        </div>
        <p className="pillar-detail text-xs text-secondary">{d1.detail}</p>
      </div>

      {/* D2 Spending Control */}
      <div className="fmi-pillar-card">
        <div className="pillar-header">
          <div className="pillar-title-group">
            <span className="pillar-code">D2</span>
            <span className="pillar-name font-semibold text-primary">Spending Control</span>
          </div>
          <span className="pillar-weight-badge text-xs font-semibold">30% Weight</span>
        </div>
        <div className="pillar-score-row">
          <span className="pillar-score font-bold text-primary tabular-nums">{d2.score}</span>
          <span className="text-tertiary text-xs">/100 score</span>
        </div>
        <div className="pillar-track" aria-hidden="true">
          <div
            className={`pillar-fill ${getPillarFillClass(d2.score)}`}
            style={{ width: `${Math.min(d2.score, 100)}%` }}
          />
        </div>
        <p className="pillar-detail text-xs text-secondary">{d2.detail}</p>
      </div>

      {/* D3 Behavioral Risk */}
      <div className="fmi-pillar-card">
        <div className="pillar-header">
          <div className="pillar-title-group">
            <span className="pillar-code">D3</span>
            <span className="pillar-name font-semibold text-primary">Behavioral Risk</span>
          </div>
          <span className="pillar-weight-badge text-xs font-semibold">30% Weight</span>
        </div>
        <div className="pillar-score-row">
          <span className="pillar-score font-bold text-primary tabular-nums">{d3.score}</span>
          <span className="text-tertiary text-xs">/100 score</span>
        </div>
        <div className="pillar-track" aria-hidden="true">
          <div
            className={`pillar-fill ${getPillarFillClass(d3.score)}`}
            style={{ width: `${Math.min(d3.score, 100)}%` }}
          />
        </div>
        <p className="pillar-detail text-xs text-secondary">{d3.detail}</p>
      </div>
    </div>
  );
};
