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
import type { SpendingTrendPoint } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';

export interface SpendingTrendChartProps {
  data: SpendingTrendPoint[];
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
}) => {

  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="insights-chart-card">
      <div className="chart-header-row">
        <div>
          <span className="overview-context-badge">OUTFLOW TRAJECTORY</span>
          <h3 className="card-title">Spending Trend</h3>
          <p className="card-subtitle">
            Historical outflow patterns across Needs, Wants, and Investments
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
              <Bar dataKey="needs" name="Needs" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={600} />
              <Bar dataKey="wants" name="Wants" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={600} />
              <Bar dataKey="investments" name="Investments" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
