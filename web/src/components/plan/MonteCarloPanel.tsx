import React from 'react';
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
    <div className="monte-carlo-container">
      <div className="monte-carlo-header">
        <div>
          <span className="mc-badge">Stochastic Simulation Engine</span>
          <h3 className="mc-title">Monte Carlo Probability & Distribution</h3>
        </div>
        <div className="mc-status-indicator">
          {isAvailable ? (
            <span className="pill-active">● 10,000 Modeled Paths</span>
          ) : (
            <span className="pill-inactive">○ Deterministic Baseline Only</span>
          )}
        </div>
      </div>

      {!isAvailable ? (
        <div className="mc-offline-banner">
          <div className="offline-icon">🔬</div>
          <div className="offline-content">
            <h4 className="offline-title">Probabilistic Simulation Standby</h4>
            <p className="offline-desc">
              The external statistical modeling microservice is currently in offline standby. FINAURA is rendering your deterministic mathematical baseline. All deterministic retirement scenarios, required contribution reverse solvers, and emergency coverage metrics remain active and authoritative.
            </p>
          </div>
        </div>
      ) : (
        <div className="mc-results-grid">
          {/* Probability of Funding Card */}
          <div className="mc-prob-card">
            <span className="prob-label">Probability of Reaching Target</span>
            <div className="prob-value">
              {probFunded !== null ? `${Math.round(probFunded * 100)}%` : '—'}
            </div>
            <p className="prob-desc">
              Percentage of 10,000 simulated market paths where final accumulated corpus satisfies or exceeds your estimated FIRE target.
            </p>
            <div className="funded-ages-row">
              <div className="funded-age-item">
                <span className="fage-label">50% Probability Age:</span>
                <span className="fage-val">
                  {fundedAge50?.ageYears !== undefined ? `${fundedAge50.ageYears.toFixed(1)} yrs` : '—'}
                </span>
              </div>
              <div className="funded-age-item">
                <span className="fage-label">75% Target Funding Age:</span>
                <span className="fage-val">
                  {fundedAge75?.ageYears !== undefined ? `${fundedAge75.ageYears.toFixed(1)} yrs` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Percentile Distribution Table (Correction #7) */}
          {percentiles && (
            <div className="mc-percentiles-card">
              <h4 className="percentiles-title">Projected Corpus Distribution (Percentiles)</h4>
              <p className="percentiles-subtitle">
                Modeled outcomes across 10,000 randomized return & volatility trajectories
              </p>

              <div className="percentiles-table-wrapper">
                <table className="percentiles-table">
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
                    <tr className="median-row">
                      <td><strong>Median (50th)</strong></td>
                      <td className="font-bold">{formatINR(percentiles.p50)}</td>
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
        <div className="explanation-facts-container">
          <h4 className="facts-title">Deterministic Engine Modeling Facts</h4>
          <div className="facts-chips-grid">
            {explanationFacts.map((fact, idx) => (
              <div key={idx} className="fact-chip">
                <span className="fact-code">{fact.code.replace(/_/g, ' ')}</span>
                {fact.metric && (
                  <span className="fact-metric">
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
