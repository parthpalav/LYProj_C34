import React from 'react';
import { FlaskConical } from 'lucide-react';
import type { ProbabilisticSection } from '../../types';

interface MonteCarloPanelProps {
  probabilistic: ProbabilisticSection | null;
  explanationFacts?: Array<{ code: string; metric?: string; value: any }>;
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

export const MonteCarloPanel: React.FC<MonteCarloPanelProps> = ({
  probabilistic,
  explanationFacts = [],
}) => {
  const isAvailable = probabilistic?.available === true;
  const estimatedFire = probabilistic?.estimatedFire;
  const probFunded = estimatedFire?.probabilityFundedAtTargetAge ?? null;
  const percentiles = estimatedFire?.corpusPercentiles ?? null;
  const fundedAge50 = estimatedFire?.fundedAge50 ?? null;
  const fundedAge75 = estimatedFire?.fundedAge75 ?? null;

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header plan-section-header--row">
        <div>
          <div className="plan-section-eyebrow plan-section-eyebrow--accent">
            <FlaskConical size={14} /> Stochastic Simulation
          </div>
          <h3 className="plan-section-title">Monte Carlo Probability & Distribution</h3>
        </div>
        <div>
          {isAvailable ? (
            <span className="plan-status-pill plan-status-pill--active">● 10,000 Modeled Paths</span>
          ) : (
            <span className="plan-status-pill plan-status-pill--inactive">○ Deterministic Baseline Only</span>
          )}
        </div>
      </div>

      {!isAvailable ? (
        <div className="plan-mc-offline">
          <FlaskConical size={28} className="plan-mc-offline-icon" />
          <div className="plan-mc-offline-content">
            <h4 className="plan-mc-offline-title">Probabilistic Simulation Standby</h4>
            <p className="plan-mc-offline-desc">
              The external statistical modeling microservice is currently in offline standby. FINAURA is rendering your deterministic mathematical baseline. All deterministic retirement scenarios, required contribution reverse solvers, and emergency coverage metrics remain active and authoritative.
            </p>
          </div>
        </div>
      ) : (
        <div className="plan-mc-results">
          {/* Probability of Funding Card */}
          <div className="plan-mc-prob-card">
            <span className="plan-mc-prob-label">Probability of Reaching Target at Retirement Age</span>
            <div className="plan-mc-prob-value">
              {probFunded !== null ? `${Math.round(probFunded * 100)}%` : '—'}
            </div>
            <p className="plan-mc-prob-desc">
              Percentage of 10,000 simulated market paths where final accumulated corpus meets or exceeds the estimated FIRE target at the target retirement age.
            </p>

            {/* Funded-age display — uses exact backend field semantics */}
            <div className="plan-mc-funded-ages">
              {fundedAge50 && (
                <div className="plan-mc-funded-age-item">
                  <span className="plan-mc-funded-label">50% of paths fund target by age:</span>
                  <span className="plan-mc-funded-val">
                    {fundedAge50.ageYears !== undefined && fundedAge50.ageYears !== null
                      ? `${fundedAge50.ageYears.toFixed(1)} yrs`
                      : '—'}
                  </span>
                </div>
              )}
              {fundedAge75 && (
                <div className="plan-mc-funded-age-item">
                  <span className="plan-mc-funded-label">75% of paths fund target by age:</span>
                  <span className="plan-mc-funded-val">
                    {fundedAge75.ageYears !== undefined && fundedAge75.ageYears !== null
                      ? `${fundedAge75.ageYears.toFixed(1)} yrs`
                      : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Percentile Distribution Table — only exact returned fields */}
          {percentiles && (
            <div className="plan-mc-percentiles">
              <h4 className="plan-mc-percentiles-title">Projected Corpus Distribution (Percentiles)</h4>
              <p className="plan-mc-percentiles-subtitle">
                Modeled outcomes across 10,000 randomized return & volatility trajectories
              </p>

              <div className="plan-table-wrapper">
                <table className="plan-table">
                  <thead>
                    <tr>
                      <th>Percentile</th>
                      <th>Projected Corpus</th>
                      <th>Statistical Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>10th Percentile</strong></td>
                      <td>{formatINR(percentiles.p10)}</td>
                      <td>Severe adverse market sequence (90% exceeded this value)</td>
                    </tr>
                    <tr>
                      <td><strong>25th Percentile</strong></td>
                      <td>{formatINR(percentiles.p25)}</td>
                      <td>Sub-par market regime (75% exceeded this value)</td>
                    </tr>
                    <tr className="plan-table-highlight">
                      <td><strong>Median (50th)</strong></td>
                      <td className="plan-text-bold">{formatINR(percentiles.p50)}</td>
                      <td>Central tendency expectation across all simulation runs</td>
                    </tr>
                    <tr>
                      <td><strong>75th Percentile</strong></td>
                      <td>{formatINR(percentiles.p75)}</td>
                      <td>Favorable market environment</td>
                    </tr>
                    <tr>
                      <td><strong>90th Percentile</strong></td>
                      <td>{formatINR(percentiles.p90)}</td>
                      <td>Top-tier market performance sequence</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deterministic Explanation Facts */}
      {explanationFacts.length > 0 && (
        <div className="plan-facts-section">
          <h4 className="plan-facts-title">Deterministic Engine Modeling Facts</h4>
          <div className="plan-facts-chips">
            {explanationFacts.map((fact, idx) => (
              <div key={idx} className="plan-fact-chip">
                <span className="plan-fact-code">{fact.code.replace(/_/g, ' ')}</span>
                {fact.metric && (
                  <span className="plan-fact-metric">
                    {fact.metric}: <strong>{typeof fact.value === 'number' ? (fact.value < 1 ? (fact.value * 100).toFixed(1) + '%' : fact.value) : String(fact.value)}</strong>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
