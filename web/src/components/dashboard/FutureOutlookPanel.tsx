import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ShieldCheck, Target, TrendingUp, AlertCircle } from 'lucide-react';
import type { PredictabilitySnapshot } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { Button } from '../ui/Button';

interface FutureOutlookPanelProps {
  snapshot?: PredictabilitySnapshot | null;
  error?: boolean;
}

export const FutureOutlookPanel: React.FC<FutureOutlookPanelProps> = ({
  snapshot,
  error,
}) => {
  if (error || !snapshot) {
    return (
      <div className="future-outlook-fallback">
        <div className="future-fallback-content">
          <AlertCircle size={18} className="future-fallback-icon" aria-hidden="true" />
          <p className="future-fallback-msg">
            Planning & projection forecasts are temporarily unavailable.
          </p>
        </div>
        <Link to="/app/plan">
          <Button variant="outline" size="sm">
            Open Planning Module
          </Button>
        </Link>
      </div>
    );
  }

  const netWorth = snapshot.assets?.knownNetWorth;
  const fireCorpus = snapshot.retirement?.estimatedFireCorpus;
  const projectedCorpus = snapshot.retirement?.projectedCorpusAtRetirement;
  const emergencyMonths = snapshot.emergencyFund?.coverageMonths;
  const emergencyTarget = snapshot.emergencyFund?.targetAmount;
  const projectedFire = snapshot.retirement?.projectedFire;

  return (
    <div className="future-outlook-panel">
      <div className="future-metrics-grid">
        {/* Metric 1: Net Worth */}
        {typeof netWorth === 'number' && (
          <div className="future-metric-card">
            <div className="future-metric-head">
              <span className="future-metric-label">Known Net Worth</span>
              <TrendingUp size={16} className="future-metric-icon" aria-hidden="true" />
            </div>
            <div className="future-metric-value">{formatCurrencyINR(netWorth)}</div>
            <span className="future-metric-subtext">Total assets minus known liabilities</span>
          </div>
        )}

        {/* Metric 2: Estimated FIRE Target */}
        {typeof fireCorpus === 'number' && fireCorpus > 0 && (
          <div className="future-metric-card">
            <div className="future-metric-head">
              <span className="future-metric-label">Target FIRE Corpus</span>
              <Target size={16} className="future-metric-icon" aria-hidden="true" />
            </div>
            <div className="future-metric-value">{formatCurrencyINR(fireCorpus)}</div>
            <span className="future-metric-subtext">
              {projectedFire?.reached
                ? `Projected reached at age ${projectedFire.projectedAge ?? 'target'}`
                : 'Based on inflation-adjusted baseline'}
            </span>
          </div>
        )}

        {/* Metric 3: Projected Corpus at Retirement */}
        {typeof projectedCorpus === 'number' && projectedCorpus > 0 && (
          <div className="future-metric-card">
            <div className="future-metric-head">
              <span className="future-metric-label">Projected Corpus</span>
              <Compass size={16} className="future-metric-icon" aria-hidden="true" />
            </div>
            <div className="future-metric-value">{formatCurrencyINR(projectedCorpus)}</div>
            <span className="future-metric-subtext">Expected accumulation at retirement age</span>
          </div>
        )}

        {/* Metric 4: Emergency Fund Runway */}
        {typeof emergencyMonths === 'number' && (
          <div className="future-metric-card">
            <div className="future-metric-head">
              <span className="future-metric-label">Emergency Runway</span>
              <ShieldCheck size={16} className="future-metric-icon" aria-hidden="true" />
            </div>
            <div className="future-metric-value">
              {emergencyMonths} {emergencyMonths === 1 ? 'Month' : 'Months'}
            </div>
            <span className="future-metric-subtext">
              {emergencyTarget ? `Target: ${formatCurrencyINR(emergencyTarget)}` : 'Liquid reserve coverage'}
            </span>
          </div>
        )}
      </div>

      <div className="future-outlook-action-bar">
        <div className="future-action-info">
          <span className="future-action-title">Detailed Scenario Modeling</span>
          <span className="future-action-desc">
            Explore Monte Carlo probability curves, goal reverse-solvers, and asset allocation in the Plan workspace.
          </span>
        </div>
        <Link to="/app/plan">
          <Button variant="outline" size="sm">
            Explore planning →
          </Button>
        </Link>
      </div>
    </div>
  );
};
