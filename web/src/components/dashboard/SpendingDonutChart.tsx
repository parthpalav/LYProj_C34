import React from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';
import type { DashboardData } from '../../types';
import { formatCurrencyINR } from '../../utils/formatters';
import { EmptyState } from './EmptyState';
import { PieChart as PieIcon } from 'lucide-react';
import { ChartDetail, DetailStat } from '../ui/ChartDetail';
import { pickOpacity, useChartPick } from '../../utils/chartPick';

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
        <span className="chart-tooltip-val tabular-nums">
          {formatCurrencyINR(item.amount)} ({item.pct}%)
        </span>
      </div>
    </div>
  );
};

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({ breakdown }) => {
  const pick = useChartPick();
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
      about: 'Essentials that are hard to skip, such as rent, groceries, bills and transport.',
    },
    {
      name: 'Wants',
      value: wantsAmt,
      amount: wantsAmt,
      pct: breakdown?.wants?.pct ?? Math.round((wantsAmt / total) * 100),
      color: '#f59e0b', // Warning / Amber
      about: 'Spending you choose, such as eating out, shopping, entertainment and travel.',
    },
    {
      name: 'Investments',
      value: invAmt,
      amount: invAmt,
      pct: breakdown?.investments?.pct ?? Math.round((invAmt / total) * 100),
      color: '#10b981', // Success / Emerald
      about: 'Money put to work for later, such as SIPs, deposits and retirement contributions.',
    },
  ];
  const picked = pick.index === null ? null : data[pick.index];
  const shown = data[pick.shown];

  return (
    <div>
      <div className="spending-donut-wrap">
        <div className="spending-donut-chart chart-pickable" style={{ width: '100%', height: 180, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={52}
                outerRadius={76}
                paddingAngle={4}
                dataKey="value"
                stroke="var(--bg-surface)"
                strokeWidth={2}
                animationDuration={500}
                onClick={(_, index) => pick.toggle(index)}
                shape={(sector: PieSectorShapeProps) => (
                  // The picked slice grows from the chart's centre while the others step back.
                  <Sector
                    {...sector}
                    style={{
                      transformOrigin: `${sector.cx}px ${sector.cy}px`,
                      transform: pick.index === sector.index ? 'scale(1.08)' : undefined,
                      opacity: pickOpacity(pick.index, sector.index),
                    }}
                  />
                )}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center" key={picked?.name ?? 'total'}>
            <span className="donut-center-top tabular-nums">
              {picked ? `${picked.pct}%` : formatCurrencyINR(total, { compact: true })}
            </span>
            <span className="donut-center-sub">{picked ? picked.name : 'Total outflow'}</span>
          </div>
        </div>

        <div className={`spending-donut-legend${picked ? ' picking' : ''}`}>
          {data.map((item, index) => (
            <button
              type="button"
              key={item.name}
              className="spending-legend-row"
              style={{ '--row-accent': item.color } as React.CSSProperties}
              aria-pressed={pick.index === index}
              onClick={() => pick.toggle(index)}
            >
              <span className="spending-legend-label-col">
                <span
                  className="spending-legend-swatch"
                  style={{ backgroundColor: item.color }}
                />
                <span className="spending-legend-name">{item.name}</span>
              </span>
              <span className="spending-legend-val-col">
                <span className="spending-legend-pct tabular-nums">{item.pct}%</span>
                <span className="spending-legend-amt tabular-nums">
                  {formatCurrencyINR(item.amount)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {!pick.open && <p className="chart-hint">Select a slice to see its summary</p>}
      <ChartDetail open={pick.open} title={`${shown.name} this month`} accent={shown.color} onClose={pick.close}>
        <dl className="chart-detail-stats">
          <DetailStat label="Spent" value={formatCurrencyINR(shown.amount)} />
          <DetailStat label="Share of outflow" value={`${shown.pct}%`} />
          <DetailStat label="Everything else" value={formatCurrencyINR(total - shown.amount)} />
        </dl>
        <div className="chart-detail-bars">
          {data.map((item) => (
            <div key={item.name} className="chart-detail-bar">
              <span>{item.name}</span>
              <i><b style={{ width: `${item.pct}%`, background: item.color, opacity: item.name === shown.name ? 1 : 0.35 }} /></i>
              <span>{item.pct}%</span>
            </div>
          ))}
        </div>
        <p className="chart-detail-note">
          {shown.about} <Link to="/app/insights">See the full breakdown in Insights</Link>
        </p>
      </ChartDetail>
    </div>
  );
};
