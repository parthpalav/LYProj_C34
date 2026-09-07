import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { SpendingTrendPoint, SpendingRange } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface SpendingTrendChartProps {
  data: SpendingTrendPoint[];
  range: SpendingRange;
  onRangeChange: (range: SpendingRange) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const needs = payload.find((p: any) => p.dataKey === 'needs')?.value || 0;
    const wants = payload.find((p: any) => p.dataKey === 'wants')?.value || 0;
    const investments = payload.find((p: any) => p.dataKey === 'investments')?.value || 0;
    const total = needs + wants + investments;

    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-header font-semibold">{label}</div>
        <div className="tooltip-row text-blue">
          <span>Needs:</span>
          <span className="font-semibold">{formatCurrencyINR(needs)}</span>
        </div>
        <div className="tooltip-row text-amber">
          <span>Wants:</span>
          <span className="font-semibold">{formatCurrencyINR(wants)}</span>
        </div>
        <div className="tooltip-row text-emerald">
          <span>Investments:</span>
          <span className="font-semibold">{formatCurrencyINR(investments)}</span>
        </div>
        <div className="tooltip-divider" />
        <div className="tooltip-row font-bold">
          <span>Total Spend:</span>
          <span>{formatCurrencyINR(total)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  data,
  range,
  onRangeChange,
}) => {
  const ranges: Array<{ id: SpendingRange; label: string }> = [
    { id: '3m', label: '3 Months' },
    { id: '6m', label: '6 Months' },
    { id: '12m', label: '12 Months' },
    { id: 'ytd', label: 'This Year' },
  ];

  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="insights-chart-card">
      <div className="chart-header-row">
        <div>
          <h3 className="card-title">Monthly Spending Trend</h3>
          <p className="card-subtitle">
            Outflow patterns across Needs, Wants, and Investments over time
          </p>
        </div>
        <div className="chart-range-pills" role="group" aria-label="Spending Time Range">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`range-pill-btn ${range === r.id ? 'active' : ''}`}
              onClick={() => onRangeChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="chart-empty-state">
          <p className="text-secondary text-sm">
            Not enough spending history in this time range to generate a monthly trend.
          </p>
        </div>
      ) : (
        <div className="chart-svg-container" style={{ height: '320px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 8 }}>
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="needs" name="Needs" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="wants" name="Wants" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="investments" name="Investments" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
