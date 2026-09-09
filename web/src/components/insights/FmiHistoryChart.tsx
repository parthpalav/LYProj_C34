import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { FmiHistoryRange } from '../../hooks/useFmiInsights';

export interface FmiHistoryChartProps {
  data: Array<{
    date: string;
    dateLabel: string;
    fullDate: string;
    score: number;
  }>;
  range: FmiHistoryRange;
  onRangeChange: (range: FmiHistoryRange) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="custom-chart-tooltip" role="tooltip">
        <div className="tooltip-header font-semibold text-primary">{item.fullDate}</div>
        <div className="tooltip-row text-primary font-bold tabular-nums">
          <span>FMI Score:</span>
          <span>{item.score} / 100</span>
        </div>
      </div>
    );
  }
  return null;
};

export const FmiHistoryChart: React.FC<FmiHistoryChartProps> = ({
  data,
  range,
  onRangeChange,
}) => {
  const ranges: Array<{ id: FmiHistoryRange; label: string }> = [
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: '6m', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="insights-chart-card">
      <div className="chart-header-row">
        <div>
          <span className="overview-context-badge">MOMENTUM TRAJECTORY</span>
          <h3 className="card-title">FMI Historical Trajectory</h3>
          <p className="card-subtitle">
            Historical progression of daily financial momentum snapshots
          </p>
        </div>
        <div className="chart-range-pills" role="group" aria-label="FMI History Range">
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

      {data.length === 0 ? (
        <div className="chart-empty-state">
          <p className="text-secondary text-sm">
            FMI history will appear here as more daily snapshots are recorded.
          </p>
        </div>
      ) : (
        <div className="chart-svg-container" style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #e2e8f0)" />
              <XAxis
                dataKey="dateLabel"
                stroke="var(--text-tertiary, #94a3b8)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="var(--text-tertiary, #94a3b8)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                name="FMI Score"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#4f46e5' }}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
