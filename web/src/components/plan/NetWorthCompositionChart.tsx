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
    <div className="net-worth-composition-container">
      <div className="composition-header">
        <h3 className="composition-title">Balance Sheet Composition</h3>
        <p className="composition-subtitle">
          Visual comparison of total accumulated assets against active liabilities
        </p>
      </div>

      <div className="composition-chart-wrapper" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
              stroke="#94a3b8"
              fontSize={12}
            />
            <YAxis type="category" dataKey="category" stroke="#94a3b8" fontSize={13} hide />
            <Tooltip content={<CompositionTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 10 }} />
            <Bar dataKey="Total Assets" fill="#10B981" radius={[0, 6, 6, 0]} barSize={32} />
            <Bar dataKey="Total Debt" fill="#EF4444" radius={[0, 6, 6, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Composition Table */}
      <div className="composition-details-grid">
        <div className="composition-detail-column">
          <h4 className="detail-column-title assets-heading">
            <span>Assets Breakdown</span>
            <span>{formatINR(totalAssetValue)}</span>
          </h4>
          {assets.length === 0 ? (
            <p className="detail-empty">No assets recorded yet.</p>
          ) : (
            <ul className="detail-list">
              {assets.map((a) => (
                <li key={a.id} className="detail-item">
                  <div className="detail-item-info">
                    <span className="item-name">{a.name}</span>
                    <span className="item-type-badge">{a.assetType}</span>
                  </div>
                  <span className="item-value">{formatINR(a.currentValue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="composition-detail-column">
          <h4 className="detail-column-title liabilities-heading">
            <span>Liabilities Breakdown</span>
            <span>{totalLiabilities > 0 ? `-${formatINR(totalLiabilities)}` : '₹0'}</span>
          </h4>
          {liabilities.length === 0 ? (
            <p className="detail-empty">No active obligations recorded.</p>
          ) : (
            <ul className="detail-list">
              {liabilities.map((l) => (
                <li key={l.id} className="detail-item">
                  <div className="detail-item-info">
                    <span className="item-name">{l.name}</span>
                    <span className="item-type-badge">{l.frequency}</span>
                  </div>
                  <span className="item-value liabilities-text">
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
