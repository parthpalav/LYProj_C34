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
import type { Asset, Liability } from '../../types';

interface NetWorthCompositionChartProps {
  assets: Asset[];
  liabilities: Liability[];
  totalAssetValue: number;
  totalLiabilities: number;
}

function formatINR(val: number): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  return `${isNeg ? '-' : ''}₹${abs.toLocaleString('en-IN')}`;
}

const CompositionTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((item: any, index: number) => (
        <p key={index} style={{ color: item.color || item.fill }}>
          {item.name}: <strong>{formatINR(Number(item.value))}</strong>
        </p>
      ))}
    </div>
  );
};

export const NetWorthCompositionChart: React.FC<NetWorthCompositionChartProps> = ({
  assets,
  liabilities,
  totalAssetValue,
  totalLiabilities,
}) => {
  const data = [
    {
      category: 'Balance Sheet',
      'Total Assets': totalAssetValue,
      'Total Debt': totalLiabilities,
    },
  ];

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header">
        <h3 className="plan-section-title">Balance Sheet Composition</h3>
        <p className="plan-section-subtitle">
          Visual comparison of total accumulated assets against active liabilities
        </p>
      </div>

      <div className="plan-chart-wrapper" style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 16, right: 24, left: 32, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.7} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
              stroke="var(--text-tertiary)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis type="category" dataKey="category" stroke="var(--text-tertiary)" fontSize={13} hide />
            <Tooltip content={<CompositionTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 10 }} />
            <Bar dataKey="Total Assets" fill="var(--success)" radius={[0, 6, 6, 0]} barSize={28} />
            <Bar dataKey="Total Debt" fill="var(--danger)" radius={[0, 6, 6, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Composition Lists */}
      <div className="plan-composition-grid">
        <div className="plan-composition-col">
          <h4 className="plan-composition-heading plan-composition-heading--assets">
            <span>Assets Breakdown</span>
            <span>{formatINR(totalAssetValue)}</span>
          </h4>
          {assets.length === 0 ? (
            <p className="plan-composition-empty">No assets recorded yet.</p>
          ) : (
            <ul className="plan-composition-list">
              {assets.map((a) => (
                <li key={a.id} className="plan-composition-item">
                  <div className="plan-composition-item-info">
                    <span className="plan-composition-item-name">{a.name}</span>
                    <span className="plan-composition-item-badge">{a.assetType}</span>
                  </div>
                  <span className="plan-composition-item-value">{formatINR(a.currentValue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="plan-composition-col">
          <h4 className="plan-composition-heading plan-composition-heading--liab">
            <span>Liabilities Breakdown</span>
            <span>{totalLiabilities > 0 ? `-${formatINR(totalLiabilities)}` : '₹0'}</span>
          </h4>
          {liabilities.length === 0 ? (
            <p className="plan-composition-empty">No active obligations recorded.</p>
          ) : (
            <ul className="plan-composition-list">
              {liabilities.map((l) => (
                <li key={l.id} className="plan-composition-item">
                  <div className="plan-composition-item-info">
                    <span className="plan-composition-item-name">{l.name}</span>
                    <span className="plan-composition-item-badge">{l.frequency}</span>
                  </div>
                  <span className="plan-composition-item-value plan-composition-item-value--liab">
                    -{formatINR(l.outstandingBalance ?? l.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
