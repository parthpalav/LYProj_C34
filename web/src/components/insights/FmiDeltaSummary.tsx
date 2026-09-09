import React from 'react';

export interface FmiDeltaSummaryProps {
  summary: {
    hasComparison: boolean;
    scoreDelta: number;
    previousScore: number | null;
    currentScore: number | null;
    hasHistoricalPillars: boolean;
    d1Delta: number | null;
    d2Delta: number | null;
    d3Delta: number | null;
    pillarsUnavailableMessage: string | null;
  };
}

export const FmiDeltaSummary: React.FC<FmiDeltaSummaryProps> = ({ summary }) => {
  if (!summary.hasComparison) {
    return (
      <div className="insights-card">
        <span className="overview-context-badge">MOMENTUM COMPARISON</span>
        <h3 className="card-title">Score Movement</h3>
        <p className="card-subtitle">Comparison against previous snapshot</p>
        <p className="text-secondary text-sm" style={{ marginTop: '12px' }}>
          {summary.pillarsUnavailableMessage || 'Record more snapshots to observe historical score deltas.'}
        </p>
      </div>
    );
  }

  const isUp = summary.scoreDelta > 0;
  const isDown = summary.scoreDelta < 0;

  const renderPillarDelta = (name: string, delta: number | null) => {
    if (delta === null) return null;
    const up = delta > 0;
    const down = delta < 0;
    return (
      <div className="pillar-delta-chip">
        <span className="chip-name text-xs text-secondary">{name}</span>
        <span className={`chip-val font-semibold text-xs tabular-nums ${up ? 'text-emerald' : down ? 'text-danger' : 'text-tertiary'}`}>
          {up ? `+${delta}` : delta}
        </span>
      </div>
    );
  };

  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <span className="overview-context-badge">MOMENTUM COMPARISON</span>
          <h3 className="card-title">Score Movement</h3>
          <p className="card-subtitle">Comparison against previous recorded snapshot</p>
        </div>
      </div>

      <div className="fmi-delta-overview-row">
        <div className="delta-stat-unit">
          <span className="stat-unit-label text-xs text-tertiary">Current</span>
          <span className="stat-unit-val font-bold text-primary tabular-nums">{summary.currentScore}</span>
        </div>
        <div className="delta-stat-unit">
          <span className="stat-unit-label text-xs text-tertiary">Previous</span>
          <span className="stat-unit-val font-semibold text-secondary tabular-nums">{summary.previousScore}</span>
        </div>
        <div className="delta-stat-unit">
          <span className="stat-unit-label text-xs text-tertiary">Overall Change</span>
          <span
            className={`delta-badge font-bold tabular-nums ${
              isUp ? 'delta-badge-pos' : isDown ? 'delta-badge-neg' : 'delta-badge-neutral'
            }`}
          >
            {isUp ? `+${summary.scoreDelta}` : summary.scoreDelta} pts
          </span>
        </div>
      </div>

      {summary.hasHistoricalPillars ? (
        <div className="pillar-deltas-row">
          <span className="pillar-deltas-title text-xs font-semibold text-tertiary">Pillar Breakdown:</span>
          <div className="pillar-chips-wrap">
            {renderPillarDelta('Saving Discipline', summary.d1Delta)}
            {renderPillarDelta('Spending Control', summary.d2Delta)}
            {renderPillarDelta('Behavioral Risk', summary.d3Delta)}
          </div>
        </div>
      ) : (
        <div className="pillar-unavailable-notice text-xs text-tertiary" style={{ marginTop: '12px' }}>
          ℹ️ {summary.pillarsUnavailableMessage || 'Detailed pillar history unavailable for this snapshot.'}
        </div>
      )}
    </div>
  );
};
