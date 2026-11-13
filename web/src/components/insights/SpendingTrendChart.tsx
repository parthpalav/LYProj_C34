import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { SpendingTrendPoint } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { ChartDetail, DetailStat } from '../ui/ChartDetail';
import { changeFrom, pickFromChart, pickOpacity, useChartPick } from '../../utils/chartPick';

export interface SpendingTrendChartProps {
  data: SpendingTrendPoint[];
  /** day-by-day points inside the bucket at this index; enables click-to-expand */
  daysOf?: (index: number) => SpendingTrendPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const needs = payload.find((p: any) => p.dataKey === 'needs')?.value || 0;
    const wants = payload.find((p: any) => p.dataKey === 'wants')?.value || 0;
    const investments = payload.find((p: any) => p.dataKey === 'investments')?.value || 0;
    const total = needs + wants + investments;

    return (
      <div className="custom-chart-tooltip" role="tooltip">
        <div className="tooltip-header font-semibold text-primary">{label}</div>
        <div className="tooltip-row text-secondary">
          <span className="tooltip-legend-dot dot-needs" aria-hidden="true" />
          <span>Needs:</span>
          <span className="font-semibold text-primary tabular-nums">{formatCurrencyINR(needs)}</span>
        </div>
        <div className="tooltip-row text-secondary">
          <span className="tooltip-legend-dot dot-wants" aria-hidden="true" />
          <span>Wants:</span>
          <span className="font-semibold text-primary tabular-nums">{formatCurrencyINR(wants)}</span>
        </div>
        <div className="tooltip-row text-secondary">
          <span className="tooltip-legend-dot dot-investments" aria-hidden="true" />
          <span>Investments:</span>
          <span className="font-semibold text-primary tabular-nums">{formatCurrencyINR(investments)}</span>
        </div>
        <div className="tooltip-divider" />
        <div className="tooltip-row font-bold text-primary">
          <span>Total Outflow:</span>
          <span className="tabular-nums">{formatCurrencyINR(total)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  data,
  daysOf,
}) => {

  const hasData = data.some((d) => d.total > 0);
  const pick = useChartPick();
  const month = data[pick.shown];
  const totalChange = month && pick.shown > 0 ? changeFrom(month.total, data[pick.shown - 1].total) : null;
  const share = (part: number) => (month && month.total > 0 ? `${Math.round((part / month.total) * 100)}% of outflow` : '');
  const dim = data.map((_, i) => <Cell key={i} fillOpacity={pickOpacity(pick.index, i)} />);

  // Picking a bucket swaps the chart to that bucket's days; a click outside the card or Esc swaps back.
  const days = useMemo(() => (pick.open && daysOf ? daysOf(pick.shown) : []), [pick.open, pick.shown, daysOf]);
  const drilled = days.length > 1;
  const card = useRef<HTMLDivElement>(null);
  const close = pick.close;
  useEffect(() => {
    if (!drilled) return;
    const onDown = (e: MouseEvent) => { if (!card.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // close is omitted from the deps: it only does a functional setState, and is a new function each render
  }, [drilled]);
  const bar = drilled ? { stackId: 'day', maxBarSize: 28 } : { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 32 };

  return (
    <div className="insights-chart-card" ref={card}>
      <div className="chart-header-row">
        <div>
          <span className="overview-context-badge">OUTFLOW TRAJECTORY</span>
          <h3 className="card-title">Spending Trend</h3>
          <p className="card-subtitle">
            {drilled ? `Day-by-day outflow in ${month.monthLabel}` : 'Historical outflow patterns across Needs, Wants, and Investments'}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="chart-empty-state">
          <p className="text-secondary text-sm">
            Not enough spending history in this time range to generate a monthly trend.
          </p>
        </div>
      ) : (
        <div key={drilled ? month.monthKey : 'all'} className={`chart-svg-container ${drilled ? 'chart-drilled' : 'chart-pickable'}`} style={{ height: '320px', width: '100%' }}>
          {drilled && (
            <button type="button" className="chart-back" onClick={close}>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </button>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={drilled ? days : data} margin={{ top: 16, right: 16, left: -8, bottom: 8 }} onClick={drilled ? undefined : pickFromChart(pick.toggle)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #e2e8f0)" />
              <XAxis
                dataKey="monthLabel"
                stroke="var(--text-tertiary, #94a3b8)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--text-tertiary, #94a3b8)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(var(--glow-rgb) / 0.07)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="needs" name="Needs" fill="#3b82f6" {...bar} animationDuration={600}>{!drilled && dim}</Bar>
              <Bar dataKey="wants" name="Wants" fill="#f59e0b" {...bar} animationDuration={600}>{!drilled && dim}</Bar>
              <Bar dataKey="investments" name="Investments" fill="#10b981" {...bar} animationDuration={600}>{!drilled && dim}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasData && !pick.open && <p className="chart-hint">Select a bar to expand it into days</p>}
      {hasData && month && (
        <ChartDetail open={pick.open} title={month.monthLabel} onClose={pick.close}>
          <dl className="chart-detail-stats">
            <DetailStat label="Total outflow" value={formatCurrencyINR(month.total)} />
            {totalChange && <DetailStat label="Vs previous month" value={totalChange.text} tone={totalChange.up ? 'neg' : 'pos'} />}
          </dl>
          <div className="chart-detail-bars">
            {([['Needs', month.needs, '#3b82f6'], ['Wants', month.wants, '#f59e0b'], ['Investments', month.investments, '#10b981']] as const).map(([name, amount, color]) => (
              <div key={name} className="chart-detail-bar" title={share(amount)}>
                <span>{name}</span>
                <i><b style={{ width: `${month.total > 0 ? (amount / month.total) * 100 : 0}%`, background: color }} /></i>
                <span>{formatCurrencyINR(amount, { compact: true })}</span>
              </div>
            ))}
          </div>
        </ChartDetail>
      )}
    </div>
  );
};
