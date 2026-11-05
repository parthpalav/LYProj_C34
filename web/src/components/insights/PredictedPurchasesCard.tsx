import React from 'react';
import { usePurchasePredictions } from '../../hooks/usePurchasePredictions';
import { formatCurrencyINR } from '../../utils/formatters';
import { SectionError } from '../dashboard/SectionError';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Likely next purchases from Apriori association rules mined over daily purchase baskets. */
export const PredictedPurchasesCard: React.FC = () => {
  const { data, loading, error, refresh } = usePurchasePredictions();

  return (
    <div className="insights-card" role="region" aria-label="Predicted purchases">
      <div className="card-header-row">
        <div>
          <span className="overview-context-badge">ASSOCIATION RULES · APRIORI</span>
          <h3 className="card-title">Likely next purchases</h3>
          <p className="card-subtitle">
            Each day's purchases form a basket. Apriori finds items you often buy on the same day or weekday and predicts what usually follows. Your most frequent buys fill any gaps.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-secondary text-sm">Mining your purchase patterns…</p>
      ) : error ? (
        <SectionError message={error} onRetry={refresh} />
      ) : !data?.available ? (
        <p className="text-secondary text-sm">
          {data?.reason === 'NOT_ENOUGH_HISTORY'
            ? `Needs at least ${data.minBaskets ?? 14} days with purchases in the last 180 days (you have ${data.basketCount}).`
            : 'The prediction service is unavailable right now. Try again shortly.'}
        </p>
      ) : (
        <div className="predicted-grid">
          <div>
            <h4 className="predicted-heading">
              {`Based on today${data.basis?.weekday ? ` (${data.basis.weekday})` : ''}`}
              {data.basis?.items.length ? `: ${data.basis.items.join(', ')}` : ''}
            </h4>
            {data.predictions && data.predictions.length > 0 ? (
              <ul className="predicted-list">
                {data.predictions.map((p) => (
                  <li key={p.item} className="predicted-item">
                    <div>
                      <strong>{p.label}</strong>
                      <span className="predicted-why">{p.reason}</span>
                    </div>
                    <div className="predicted-metrics">
                      <span className="predicted-confidence">{pct(p.confidence)} likely</span>
                      {p.typicalAmount !== null && <span className="predicted-why">usually {formatCurrencyINR(p.typicalAmount)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-secondary text-sm">No strong rule matches that basket yet.</p>
            )}
          </div>

          <div>
            <h4 className="predicted-heading">Often bought together</h4>
            {data.rules && data.rules.length > 0 ? (
              <table className="predicted-rules">
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Support</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Lift</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map((r) => (
                    <tr key={`${r.antecedent.join('+')}>${r.consequent}`}>
                      <td>{r.antecedent.join(' + ')} → {r.consequent}</td>
                      <td>{pct(r.support)}</td>
                      <td>{pct(r.confidence)}</td>
                      <td>{r.lift.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-secondary text-sm">No rules above the support and confidence thresholds yet.</p>
            )}
            <p className="predicted-why">From {data.basketCount} days of purchases.</p>
          </div>
        </div>
      )}
    </div>
  );
};
