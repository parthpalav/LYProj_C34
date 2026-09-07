import React from 'react';
import type { PredictabilitySnapshot } from '../../types';
import type { ScenarioComparisonDeltas } from '../../hooks/useScenarioLab';

interface ScenarioComparisonViewProps {
  baselineSnapshot: PredictabilitySnapshot | null;
  scenarioSnapshot: PredictabilitySnapshot | null;
  deltas: ScenarioComparisonDeltas;
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const ScenarioComparisonView: React.FC<ScenarioComparisonViewProps> = ({
  baselineSnapshot,
  scenarioSnapshot,
  deltas,
}) => {
  const baseRet = baselineSnapshot?.retirement;
  const scenRet = scenarioSnapshot?.retirement;

  const baseCorpus = baseRet?.projectedCorpusAtRetirement ?? null;
  const scenCorpus = scenRet?.projectedCorpusAtRetirement ?? null;

  const baseAge = baseRet?.projectedFire?.projectedAge ?? null;
  const scenAge = scenRet?.projectedFire?.projectedAge ?? null;

  const baseReq = baseRet?.requiredMonthlyContributionForEstimatedFire ?? null;
  const scenReq = scenRet?.requiredMonthlyContributionForEstimatedFire ?? null;

  const baseProb = baselineSnapshot?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;
  const scenProb = scenarioSnapshot?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;

  return (
    <div className="scenario-comparison-container">
      <div className="comparison-header">
        <h3 className="comparison-title">Scenario Comparison Matrix</h3>
        <p className="comparison-subtitle">
          Side-by-side evaluation of your Current Baseline versus Simulated Scenario outputs
        </p>
      </div>

      {/* Delta Highlight Cards */}
      <div className="deltas-cards-grid">
        {/* Corpus Delta */}
        <div className="delta-card">
          <span className="delta-card-label">Projected Retirement Corpus</span>
          <div className="delta-values-row">
            <span className="val-base">{formatINR(baseCorpus)}</span>
            <span className="val-arrow">→</span>
            <span className="val-scen">{formatINR(scenCorpus)}</span>
          </div>
          {deltas.projectedCorpusDelta !== null && (
            <div
              className={`delta-badge ${
                deltas.projectedCorpusDelta >= 0 ? 'badge-positive' : 'badge-negative'
              }`}
            >
              {deltas.projectedCorpusDelta >= 0 ? '+' : ''}
              {formatINR(deltas.projectedCorpusDelta)} ({deltas.projectedCorpusDeltaPct}%)
            </div>
          )}
        </div>

        {/* Projected FIRE Age Delta */}
        <div className="delta-card">
          <span className="delta-card-label">Projected FIRE Age</span>
          <div className="delta-values-row">
            <span className="val-base">{baseAge !== null ? `${baseAge.toFixed(1)}y` : '—'}</span>
            <span className="val-arrow">→</span>
            <span className="val-scen">{scenAge !== null ? `${scenAge.toFixed(1)}y` : '—'}</span>
          </div>
          {deltas.fireAgeDeltaYears !== null && (
            <div
              className={`delta-badge ${
                deltas.fireAgeDeltaYears <= 0 ? 'badge-positive' : 'badge-negative'
              }`}
            >
              {deltas.fireAgeDeltaYears <= 0
                ? `${Math.abs(deltas.fireAgeDeltaYears)} yrs earlier`
                : `${deltas.fireAgeDeltaYears} yrs later`}
            </div>
          )}
        </div>

        {/* Required Contribution Delta */}
        <div className="delta-card">
          <span className="delta-card-label">Required Monthly Investment</span>
          <div className="delta-values-row">
            <span className="val-base">{formatINR(baseReq)}</span>
            <span className="val-arrow">→</span>
            <span className="val-scen">{formatINR(scenReq)}</span>
          </div>
          {deltas.requiredContributionDelta !== null && (
            <div
              className={`delta-badge ${
                deltas.requiredContributionDelta <= 0 ? 'badge-positive' : 'badge-negative'
              }`}
            >
              {deltas.requiredContributionDelta > 0 ? '+' : ''}
              {formatINR(deltas.requiredContributionDelta)}/mo
            </div>
          )}
        </div>

        {/* Funding Probability Delta */}
        <div className="delta-card">
          <span className="delta-card-label">Probability of Funding</span>
          <div className="delta-values-row">
            <span className="val-base">
              {baseProb !== null ? `${Math.round(baseProb * 100)}%` : '—'}
            </span>
            <span className="val-arrow">→</span>
            <span className="val-scen">
              {scenProb !== null ? `${Math.round(scenProb * 100)}%` : '—'}
            </span>
          </div>
          {deltas.probabilityDeltaPoints !== null && (
            <div
              className={`delta-badge ${
                deltas.probabilityDeltaPoints >= 0 ? 'badge-positive' : 'badge-negative'
              }`}
            >
              {deltas.probabilityDeltaPoints >= 0 ? '+' : ''}
              {deltas.probabilityDeltaPoints} percentage pts
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Detailed Parameter Table */}
      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metric / Assumption</th>
              <th>Current Plan (Baseline)</th>
              <th>Simulated Scenario</th>
              <th>Net Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Target Retirement Age</td>
              <td>{baseRet?.retirementAge ?? 60} years</td>
              <td>{scenRet?.retirementAge ?? 60} years</td>
              <td>
                {(scenRet?.retirementAge ?? 60) - (baseRet?.retirementAge ?? 60) !== 0
                  ? `${(scenRet?.retirementAge ?? 60) - (baseRet?.retirementAge ?? 60)} yrs`
                  : 'Identical'}
              </td>
            </tr>
            <tr>
              <td>Monthly Investment Used</td>
              <td>{formatINR(baseRet?.monthlyContributionUsed)}</td>
              <td>{formatINR(scenRet?.monthlyContributionUsed)}</td>
              <td>
                {formatINR(
                  (scenRet?.monthlyContributionUsed ?? 0) - (baseRet?.monthlyContributionUsed ?? 0)
                )}
              </td>
            </tr>
            <tr>
              <td>Nominal Return Assumption</td>
              <td>{((baseRet?.assumptions.nominalReturn ?? 0.08) * 100).toFixed(1)}%</td>
              <td>{((scenRet?.assumptions.nominalReturn ?? 0.08) * 100).toFixed(1)}%</td>
              <td>
                {(
                  ((scenRet?.assumptions.nominalReturn ?? 0.08) -
                    (baseRet?.assumptions.nominalReturn ?? 0.08)) *
                  100
                ).toFixed(1)}
                %
              </td>
            </tr>
            <tr>
              <td>Inflation Assumption</td>
              <td>{((baseRet?.assumptions.inflation ?? 0.06) * 100).toFixed(1)}%</td>
              <td>{((scenRet?.assumptions.inflation ?? 0.06) * 100).toFixed(1)}%</td>
              <td>
                {(
                  ((scenRet?.assumptions.inflation ?? 0.06) -
                    (baseRet?.assumptions.inflation ?? 0.06)) *
                  100
                ).toFixed(1)}
                %
              </td>
            </tr>
            <tr>
              <td>Contribution Modeling Mode</td>
              <td>{baseRet?.assumptions.contributionMode ?? 'NOMINAL_FLAT'}</td>
              <td>{scenRet?.assumptions.contributionMode ?? 'NOMINAL_FLAT'}</td>
              <td>
                {baseRet?.assumptions.contributionMode === scenRet?.assumptions.contributionMode
                  ? 'Same'
                  : 'Altered'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
