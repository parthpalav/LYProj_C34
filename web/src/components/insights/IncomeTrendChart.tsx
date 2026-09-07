import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { IncomeTrendPoint } from '../../types';
import type { IncomeRange } from '../../hooks/useIncomeInsights';
import { formatCurrencyINR } from '../../utils/formatters';

export interface IncomeTrendChartProps {
  data: IncomeTrendPoint[];
  averageIncome: number;
  range: IncomeRange;
  onRangeChange: (range: IncomeRange) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const mean = item.averageIncome;
    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-header font-semibold">{label}</div>
        <div className="tooltip-row text-emerald">
          <span>Total Inflow:</span>
          <span className="font-bold">+{formatCurrencyINR(item.amount)}</span>
        </div>
        <div className="tooltip-row text-secondary text-xs">
          <span>Transactions:</span>
          <span>{item.eventCount}</span>
        </div>
        {mean > 0 && (
          <div className="tooltip-row text-tertiary text-xs">
            <span>Mean Baseline:</span>
            <span>{formatCurrencyINR(mean)}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const IncomeTrendChart: React.FC<IncomeTrendChartProps> = ({
  data,
  averageIncome,
  range,
  onRangeChange,
}) => {
  const ranges: Array<{ id: IncomeRange; label: string }> = [
    { id: '6m', label: '6 Months' },
    { id: '12m', label: '12 Months' },
    { id: 'all', label: 'All Time' },
  ];

  const chartDataWithMean = React.useMemo(() => {
    return data.map((d) => ({ ...d, averageIncome }));
  }, [data, averageIncome]);

  const hasData = data.some((d) => d.amount > 0);

  return (
    <div className="insights-chart-card">
      <div className="chart-header-row">
        <div>
          <h3 className="card-title">Monthly Income History</h3>
          <p className="card-subtitle">
            Historical inflow trajectory with statistical mean baseline
          </p>
        </div>
        <div className="chart-range-pills" role="group" aria-label="Income Trend Range">
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
            Add income records to begin analyzing monthly income trends.
          </p>
        </div>
      ) : (
        <div className="chart-svg-container" style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDataWithMean} margin={{ top: 16, right: 16, left: -8, bottom: 8 }}>
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
              {averageIncome > 0 && (
                <ReferenceLine
                  y={averageIncome}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Mean: ${formatCurrencyINR(averageIncome)}`,
                    fill: '#10b981',
                    fontSize: 11,
                    position: 'top',
                  }}
                />
              )}
              <Bar
                dataKey="amount"
                name="Monthly Inflow"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
