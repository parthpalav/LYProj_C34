import React from 'react';
import { ArrowRight } from 'lucide-react';
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

function formatDeltaLabel(delta: number, unit: string): string {
  if (delta === 0) return 'Unchanged';
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${delta}${unit}`;
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
    <div className="plan-surface-card">
      <div className="plan-section-header">
        <h3 className="plan-section-title">Scenario Comparison</h3>
        <p className="plan-section-subtitle">
          Side-by-side evaluation of your current baseline versus simulated scenario outputs
        </p>
      </div>

      {/* Delta Highlight Cards — neutral styling per correction #20 */}
      <div className="plan-delta-grid">
        {/* Corpus Delta */}
        <div className="plan-delta-card">
          <span className="plan-delta-label">Projected Retirement Corpus</span>
          <div className="plan-delta-values">
            <span className="plan-delta-base">{formatINR(baseCorpus)}</span>
            <ArrowRight size={14} className="plan-delta-arrow" />
            <span className="plan-delta-scen">{formatINR(scenCorpus)}</span>
          </div>
          {deltas.projectedCorpusDelta !== null && (
            <div className={`plan-delta-badge ${deltas.projectedCorpusDelta === 0 ? 'plan-delta-badge--neutral' : deltas.projectedCorpusDelta > 0 ? 'plan-delta-badge--increase' : 'plan-delta-badge--decrease'}`}>
              {deltas.projectedCorpusDelta === 0
                ? 'Unchanged'
                : `${deltas.projectedCorpusDelta > 0 ? '+' : ''}${formatINR(deltas.projectedCorpusDelta)} (${deltas.projectedCorpusDeltaPct}%)`
              }
            </div>
          )}
        </div>

        {/* Projected FIRE Age Delta */}
        <div className="plan-delta-card">
          <span className="plan-delta-label">Projected FIRE Age</span>
          <div className="plan-delta-values">
            <span className="plan-delta-base">{baseAge !== null ? `${baseAge.toFixed(1)}y` : '—'}</span>
            <ArrowRight size={14} className="plan-delta-arrow" />
            <span className="plan-delta-scen">{scenAge !== null ? `${scenAge.toFixed(1)}y` : '—'}</span>
          </div>
          {deltas.fireAgeDeltaYears !== null && (
            <div className={`plan-delta-badge ${deltas.fireAgeDeltaYears === 0 ? 'plan-delta-badge--neutral' : deltas.fireAgeDeltaYears < 0 ? 'plan-delta-badge--decrease' : 'plan-delta-badge--increase'}`}>
              {formatDeltaLabel(deltas.fireAgeDeltaYears, ' yrs')}
            </div>
          )}
        </div>

        {/* Required Contribution Delta */}
        <div className="plan-delta-card">
          <span className="plan-delta-label">Required Monthly Investment</span>
          <div className="plan-delta-values">
            <span className="plan-delta-base">{formatINR(baseReq)}</span>
            <ArrowRight size={14} className="plan-delta-arrow" />
            <span className="plan-delta-scen">{formatINR(scenReq)}</span>
          </div>
          {deltas.requiredContributionDelta !== null && (
            <div className={`plan-delta-badge ${deltas.requiredContributionDelta === 0 ? 'plan-delta-badge--neutral' : deltas.requiredContributionDelta > 0 ? 'plan-delta-badge--increase' : 'plan-delta-badge--decrease'}`}>
              {deltas.requiredContributionDelta === 0
                ? 'Unchanged'
                : `${deltas.requiredContributionDelta > 0 ? '+' : ''}${formatINR(deltas.requiredContributionDelta)}/mo`
              }
            </div>
          )}
        </div>

        {/* Funding Probability Delta */}
        <div className="plan-delta-card">
          <span className="plan-delta-label">Probability of Funding</span>
          <div className="plan-delta-values">
            <span className="plan-delta-base">
              {baseProb !== null ? `${Math.round(baseProb * 100)}%` : '—'}
            </span>
            <ArrowRight size={14} className="plan-delta-arrow" />
            <span className="plan-delta-scen">
              {scenProb !== null ? `${Math.round(scenProb * 100)}%` : '—'}
            </span>
          </div>
          {deltas.probabilityDeltaPoints !== null && (
            <div className={`plan-delta-badge ${deltas.probabilityDeltaPoints === 0 ? 'plan-delta-badge--neutral' : deltas.probabilityDeltaPoints > 0 ? 'plan-delta-badge--increase' : 'plan-delta-badge--decrease'}`}>
              {formatDeltaLabel(deltas.probabilityDeltaPoints, ' pp')}
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Detailed Parameter Table */}
      <div className="plan-table-wrapper">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Metric / Assumption</th>
              <th>Current Plan (Baseline)</th>
              <th>Simulated Scenario</th>
              <th>Difference</th>
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
