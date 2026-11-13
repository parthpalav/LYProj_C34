import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
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
import { ChartDetail, DetailStat } from '../ui/ChartDetail';
import { changeFrom, pickFromChart, pickOpacity, useChartPick } from '../../utils/chartPick';

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
  const pick = useChartPick();
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
  const month = data[pick.shown];
  const netChange = month && pick.shown > 0 ? changeFrom(month.netFlow, data[pick.shown - 1].netFlow) : null;
  const dim = formattedData.map((_, i) => <Cell key={i} fillOpacity={pickOpacity(pick.index, i)} />);

  return (
    <div className="cash-flow-chart-wrap chart-pickable">
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
            onClick={pickFromChart(pick.toggle)}
          >
            <CartesianGrid
              strokeDasharray="2 3"
              vertical={false}
              stroke="var(--border-subtle)"
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(var(--glow-rgb) / 0.07)' }} />
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
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              animationDuration={500}
            >
              {dim}
            </Bar>
            <Bar
              name="Expenses"
              dataKey="expenses"
              fill="#ef4444"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              animationDuration={500}
            >
              {dim}
            </Bar>
            <Bar
              name="Net Flow"
              dataKey="netFlow"
              fill="#2563eb"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              animationDuration={500}
            >
              {dim}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!pick.open && <p className="chart-hint">Select a month to see its summary</p>}
      {month && (
        <ChartDetail open={pick.open} title={month.monthLabel} accent={month.netFlow >= 0 ? '#10b981' : '#ef4444'} onClose={pick.close}>
          <dl className="chart-detail-stats">
            <DetailStat label="Income" value={formatCurrencyINR(month.income)} />
            <DetailStat label="Expenses" value={formatCurrencyINR(month.expenses)} />
            <DetailStat label="Net flow" value={formatCurrencyINR(month.netFlow, { showSign: true })} tone={month.netFlow >= 0 ? 'pos' : 'neg'} />
            {month.income > 0 && <DetailStat label="Kept from income" value={`${Math.round((month.netFlow / month.income) * 100)}%`} />}
            {netChange && <DetailStat label="Net vs previous month" value={netChange.text} tone={netChange.up ? 'pos' : 'neg'} />}
          </dl>
        </ChartDetail>
      )}
    </div>
  );
};
