import React from 'react';
import type { MonthlyCommitments } from '../../types';
import { formatCurrencyINR, formatDateShort } from '../../utils/formatters';
import { dateKeyToDate } from '../../utils/timezone';

const day = (key: string) => formatDateShort(dateKeyToDate(key));

/** How much of the current balance this month's auto-deduct liabilities will take. */
export const CommittedBalanceCard: React.FC<{ commitments: MonthlyCommitments }> = ({ commitments: c }) => {
  if (c.items.length === 0) {
    return <p className="committed-empty">No auto-deduct liabilities this month. Turn on auto-deduct for a bill to see it here.</p>;
  }
  const usedPct = c.currentBalance > 0 ? Math.min(100, (c.remaining / c.currentBalance) * 100) : 100;

  return (
    <div className="committed-card">
      <div className="committed-summary">
        <div>
          <span className="committed-label">Still to be deducted by {day(c.monthEnd)}</span>
          <strong className="committed-value">{formatCurrencyINR(c.remaining)}</strong>
        </div>
        <div>
          <span className="committed-label">Free to use after bills</span>
          <strong className={`committed-value ${c.freeBalance < 0 ? 'committed-negative' : ''}`}>{formatCurrencyINR(c.freeBalance)}</strong>
        </div>
        <div>
          <span className="committed-label">Already deducted</span>
          <strong className="committed-value committed-muted">{formatCurrencyINR(c.paidSoFar)}</strong>
        </div>
      </div>

      <div
        className="committed-bar"
        role="progressbar"
        aria-valuenow={Math.round(usedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(usedPct)}% of current balance committed to bills`}
      >
        <div className="committed-bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="committed-caption">
        {Math.round(usedPct)}% of your {formatCurrencyINR(c.currentBalance)} balance is set aside
        {Object.entries(c.byType).map(([type, t]) => ` · ${type} ${formatCurrencyINR(t.remaining)}`).join('')}
      </p>

      <ul className="committed-list">
        {c.items.map((it) => (
          <li key={it.id} className="committed-item">
            <div className="committed-item-name">
              <span>{it.name}</span>
              <span className={`committed-tag committed-tag-${it.type.toLowerCase()}`}>{it.type}</span>
            </div>
            <div className="committed-item-dates">
              {it.paidDates.map((d) => (
                <span key={`p${d}`} className="committed-date committed-date-paid">✓ {day(d)}</span>
              ))}
              {it.dueDates.map((d) => (
                <span key={`d${d}`} className="committed-date">{day(d)}</span>
              ))}
            </div>
            <span className="committed-item-amount">
              {it.remainingAmount > 0 ? formatCurrencyINR(it.remainingAmount) : 'Paid'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
