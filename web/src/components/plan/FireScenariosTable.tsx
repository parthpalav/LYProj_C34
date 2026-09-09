import React from 'react';
import type { ScenarioProjection } from '../../types';

interface FireScenariosTableProps {
  scenarios: {
    conservative?: ScenarioProjection;
    base?: ScenarioProjection;
    optimistic?: ScenarioProjection;
  } | null;
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

export const FireScenariosTable: React.FC<FireScenariosTableProps> = ({ scenarios }) => {
  if (!scenarios || !scenarios.base) {
    return null;
  }

  const scenarioList = [
    { key: 'conservative', title: 'Conservative', item: scenarios.conservative, tagClass: 'plan-scenario-tag--conservative' },
    { key: 'base', title: 'Base (Current Plan)', item: scenarios.base, tagClass: 'plan-scenario-tag--base' },
    { key: 'optimistic', title: 'Optimistic', item: scenarios.optimistic, tagClass: 'plan-scenario-tag--optimistic' },
  ].filter((s) => Boolean(s.item));

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header">
        <h3 className="plan-section-title">Deterministic Retirement Scenarios</h3>
        <p className="plan-section-subtitle">
          Market sensitivity analysis comparing conservative, base, and optimistic return/inflation environments
        </p>
      </div>

      <div className="plan-table-wrapper">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Scenario Profile</th>
              <th>Nominal Return</th>
              <th>Inflation</th>
              <th>Real Return</th>
              <th>Projected Corpus</th>
              <th>Projected FIRE Age</th>
              <th>Required Monthly</th>
              <th>Monthly Gap</th>
            </tr>
          </thead>
          <tbody>
            {scenarioList.map(({ key, title, item, tagClass }) => {
              if (!item) return null;
              const assump = item.assumptions;
              const isBase = key === 'base';

              return (
                <tr key={key} className={isBase ? 'plan-table-highlight' : ''}>
                  <td>
                    <span className={`plan-scenario-tag ${tagClass}`}>{title}</span>
                  </td>
                  <td>{(assump.nominalReturn * 100).toFixed(1)}%</td>
                  <td>{(assump.inflation * 100).toFixed(1)}%</td>
                  <td className="plan-text-bold">{(assump.realReturn * 100).toFixed(2)}%</td>
                  <td className="td-value">
                    {formatINR(item.projectedCorpusAtRetirement)}
                  </td>
                  <td>
                    {item.projectedFire.projectedAge !== null
                      ? `${item.projectedFire.projectedAge.toFixed(1)} yrs`
                      : '—'}
                  </td>
                  <td>{formatINR(item.requiredMonthlyContributionForEstimatedFire)}/mo</td>
                  <td className={item.contributionGap && item.contributionGap > 0 ? 'plan-text-danger' : 'plan-text-success'}>
                    {item.contributionGap && item.contributionGap > 0
                      ? `+${formatINR(item.contributionGap)}/mo shortfall`
                      : 'Covered'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
