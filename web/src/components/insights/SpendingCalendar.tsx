import React, { useEffect, useMemo, useState } from 'react';
import { getHeatmapReport } from '../../services/api';
import { formatCurrencyINR } from '../../utils/formatters';

const WEEKS = 12;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Last 12 weeks of daily spend as a GitHub-style grid (mobile Insights "Spending calendar"). */
export const SpendingCalendar: React.FC = () => {
  const [heat, setHeat] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getHeatmapReport()
      .then((points) => mounted && setHeat(Object.fromEntries((points ?? []).map((p) => [p.date.slice(0, 10), p.totalAmount]))))
      .catch(() => mounted && setFailed(true));
    return () => { mounted = false; };
  }, []);

  // Columns are weeks (Sun..Sat), ending with the current week.
  const grid = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - today.getDay()));
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (WEEKS - 1 - w) * 7 - (6 - d));
        return { key: dayKey(date), date, future: date > today };
      }));
  }, []);
  const maxDay = Math.max(1, ...grid.flat().map((g) => heat[g.key] ?? 0));
  const pickedDay = picked ? grid.flat().find((g) => g.key === picked) : null;

  if (failed) return null;

  return (
    <section className="insights-card" aria-label="Spending calendar">
      <h3 className="dashboard-card-title" style={{ marginBottom: 12 }}>Spending calendar</h3>
      <div className="heat-wrap">
        <div className="heat-col" aria-hidden="true">
          {DAY_LETTERS.map((l, i) => <span key={i} className="heat-letter">{l}</span>)}
        </div>
        {grid.map((week, w) => (
          <div key={w} className="heat-col">
            {week.map((d) => {
              const amount = heat[d.key] ?? 0;
              const level = amount > 0 ? 0.2 + 0.8 * Math.min(1, amount / maxDay) : 0;
              return (
                <button
                  key={d.key}
                  type="button"
                  className="heat-cell"
                  disabled={d.future}
                  aria-pressed={picked === d.key}
                  aria-label={`${d.date.toDateString()}: ${formatCurrencyINR(amount)}`}
                  title={`${d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${formatCurrencyINR(amount)}`}
                  onClick={() => setPicked(d.key === picked ? null : d.key)}
                  style={level ? { background: 'var(--accent-primary)', opacity: level } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="parity-muted" style={{ marginTop: 10, fontSize: 13 }}>
        {pickedDay
          ? `${pickedDay.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatCurrencyINR(heat[pickedDay.key] ?? 0)}`
          : 'Last 12 weeks. Darker days cost more. Click a day for the total.'}
      </p>
    </section>
  );
};
