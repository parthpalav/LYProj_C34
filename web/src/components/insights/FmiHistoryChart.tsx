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
import { ChartDetail, DetailStat } from '../ui/ChartDetail';
import { pickFromChart, useChartPick } from '../../utils/chartPick';

export interface FmiHistoryChartProps {
  data: Array<{
    date: string;
    dateLabel: string;
    fullDate: string;
    score: number;
  }>;
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
}) => {
  const pick = useChartPick();
  const point = data[pick.shown];
  const points = (from: number | undefined) => {
    if (!point || from === undefined) return null;
    const diff = point.score - from;
    return { text: `${diff >= 0 ? '+' : ''}${diff} pts`, tone: diff >= 0 ? ('pos' as const) : ('neg' as const) };
  };
  const vsPrevious = points(pick.shown > 0 ? data[pick.shown - 1]?.score : undefined);
  const vsStart = points(pick.shown > 0 ? data[0]?.score : undefined);

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
      </div>

      {data.length === 0 ? (
        <div className="chart-empty-state">
          <p className="text-secondary text-sm">
            FMI history will appear here as more daily snapshots are recorded.
          </p>
        </div>
      ) : (
        <div className="chart-svg-container chart-pickable" style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 8 }} onClick={pickFromChart(pick.toggle)}>
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
                dot={({ key, cx, cy, index }) => (
                  <circle key={key} className="recharts-dot" cx={cx} cy={cy} r={pick.index === index ? 7 : 4} fill={pick.index === index ? '#4f46e5' : '#6366f1'} stroke="var(--bg-surface)" strokeWidth={2} />
                )}
                activeDot={{ r: 6, fill: '#4f46e5' }}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 && !pick.open && <p className="chart-hint">Select a point to see that day's score</p>}
      {point && (
        <ChartDetail open={pick.open} title={point.fullDate} accent="#6366f1" onClose={pick.close}>
          <dl className="chart-detail-stats">
            <DetailStat label="FMI score" value={`${point.score} / 100`} />
            {vsPrevious && <DetailStat label="Vs previous snapshot" value={vsPrevious.text} tone={vsPrevious.tone} />}
            {vsStart && <DetailStat label="Since start of range" value={vsStart.text} tone={vsStart.tone} />}
          </dl>
        </ChartDetail>
      )}
    </div>
  );
};
