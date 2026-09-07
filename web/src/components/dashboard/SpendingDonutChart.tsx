import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import type { DashboardData } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { EmptyState } from './EmptyState';
import { PieChart as PieIcon } from 'lucide-react';

interface SpendingDonutChartProps {
  breakdown?: DashboardData['wantsNeedsBreakdown'];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
      amount: number;
      pct: number;
      color: string;
    };
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label" style={{ color: item.color }}>
        {item.name}
      </div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-val">
          {formatCurrencyINR(item.amount)} ({item.pct}%)
        </span>
      </div>
    </div>
  );
};

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({ breakdown }) => {
  const needsAmt = breakdown?.needs?.amount || 0;
  const wantsAmt = breakdown?.wants?.amount || 0;
  const invAmt = breakdown?.investments?.amount || 0;
  const total = needsAmt + wantsAmt + invAmt;

  if (total <= 0) {
    return (
      <EmptyState
        icon={PieIcon}
        message="No categorized expenses recorded for the current calendar month."
        className="chart-empty-state"
      />
    );
  }

  const data = [
    {
      name: 'Needs',
      value: needsAmt,
      amount: needsAmt,
      pct: breakdown?.needs?.pct ?? Math.round((needsAmt / total) * 100),
      color: '#2563eb', // Brand / Accent primary
    },
    {
      name: 'Wants',
      value: wantsAmt,
      amount: wantsAmt,
      pct: breakdown?.wants?.pct ?? Math.round((wantsAmt / total) * 100),
      color: '#f59e0b', // Warning / Amber
    },
    {
      name: 'Investments',
      value: invAmt,
      amount: invAmt,
      pct: breakdown?.investments?.pct ?? Math.round((invAmt / total) * 100),
      color: '#10b981', // Success / Emerald
    },
  ];

  return (
    <div className="spending-donut-wrap">
      <div className="spending-donut-chart" style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="var(--bg-surface)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="spending-donut-legend">
        {data.map((item) => (
          <div key={item.name} className="spending-legend-row">
            <div className="spending-legend-label-col">
              <span
                className="spending-legend-swatch"
                style={{ backgroundColor: item.color }}
              />
              <span className="spending-legend-name">{item.name}</span>
            </div>
            <div className="spending-legend-val-col">
              <span className="spending-legend-pct">{item.pct}%</span>
              <span className="spending-legend-amt">
                {formatCurrencyINR(item.amount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
