import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { CashFlowMonth } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { EmptyState } from './EmptyState';
import { TrendingUp } from 'lucide-react';

interface CashFlowChartProps {
  data: CashFlowMonth[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-items">
        {payload.map((item) => (
          <div key={item.name} className="chart-tooltip-item">
            <span
              className="chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
            />
            <span className="chart-tooltip-name">{item.name}:</span>
            <span className="chart-tooltip-val">
              {formatCurrencyINR(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  // Check if there is any financial activity across all months
  const hasData = data.some(
    (m) => m.income > 0 || m.expenses > 0 || m.netFlow !== 0
  );

  if (!hasData) {
    return (
      <EmptyState
        icon={TrendingUp}
        message="Your cash-flow trend will appear after you record income and expenses."
        className="chart-empty-state"
      />
    );
  }

  // Format short month on X-axis (e.g. "Apr")
  const formattedData = data.map((d) => ({
    ...d,
    shortLabel: d.monthLabel.split(' ')[0],
  }));

  return (
    <div className="cash-flow-chart-wrap">
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border-default)"
            />
            <XAxis
              dataKey="shortLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              tickFormatter={(val) => formatCurrencyINR(val, { compact: true })}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
            />
            <Bar
              name="Income"
              dataKey="income"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              name="Expenses"
              dataKey="expenses"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              name="Net Flow"
              dataKey="netFlow"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
