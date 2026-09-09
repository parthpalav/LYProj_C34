import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Calendar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Info,
  Percent,
  CalendarRange
} from 'lucide-react';
import type { HistoricalMonthSummary } from '../../types';
import type { HistoryRange } from '../../hooks/useReportHistory';

interface HistoryReportViewProps {
  summaries: HistoricalMonthSummary[];
  range: HistoryRange;
  loading: boolean;
  error: string | null;
  onSelectRange: (range: HistoryRange) => void;
  onInspectMonth: (year: number, month: number) => void;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

// Module-level custom tooltip for Recharts to adhere to Oxlint component-creation rules
const HistoryTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="report-chart-tooltip">
      <div className="report-tooltip-title">{label}</div>
      {payload.map((entry, idx) => (
        <div key={idx} className="report-tooltip-row">
          <span className="report-tooltip-dot" style={{ backgroundColor: entry.color }} />
          <span className="report-tooltip-label">{entry.name}:</span>
          <span className="report-tooltip-value tabular-nums">
            {entry.name.includes('%') || entry.name.includes('Rate') || entry.name.includes('FMI')
              ? entry.value
              : `₹${Number(entry.value).toLocaleString('en-IN')}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export const HistoryReportView: React.FC<HistoryReportViewProps> = ({
  summaries,
  range,
  loading,
  error,
  onSelectRange,
  onInspectMonth
}) => {
  const hasActivity = summaries.some((s) => s.totalIncome > 0 || s.totalExpenses > 0);

  // Aggregated totals across currently loaded historical dataset
  const historicalTotals = React.useMemo(() => {
    let income = 0;
    let expenses = 0;
    let net = 0;
    let savingsRateSum = 0;
    let monthsWithIncome = 0;

    summaries.forEach((s) => {
      income += s.totalIncome;
      expenses += s.totalExpenses;
      net += s.netCashFlow;
      if (s.totalIncome > 0) {
        savingsRateSum += s.savingsRate;
        monthsWithIncome += 1;
      }
    });

    const avgSavingsRate = monthsWithIncome > 0 ? Math.round(savingsRateSum / monthsWithIncome) : 0;
    return { income, expenses, net, avgSavingsRate };
  }, [summaries]);

  // Reverse chronological list for timeline cards
  const timelineCards = [...summaries].reverse();

  return (
    <div className="report-view-container">
      {/* Header with Range Filter Controls */}
      <div className="report-header-banner no-print">
        <div className="report-header-info">
          <div className="report-type-badge">
            <CalendarRange size={12} className="inline mr-1" />
            Multi-Period Longitudinal Trajectory
          </div>
          <h2 className="report-title">Historical Financial Trajectory</h2>
          <p className="report-period-text">
            Longitudinal comparison of income, outflow discipline, and FMI health across accounting cycles
          </p>
        </div>

        <div className="report-range-filter-group" role="group" aria-label="Select history range">
          {(['6M', '12M', 'YTD'] as HistoryRange[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`report-range-btn ${range === r ? 'active' : ''}`}
              onClick={() => onSelectRange(r)}
              aria-pressed={range === r}
            >
              {r === '6M' ? '6 Months' : r === '12M' ? '12 Months' : 'This Year (YTD)'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="report-loading-container">
          <div className="spinner" />
          <p>Compiling historical multi-month summaries...</p>
        </div>
      ) : error ? (
        <div className="report-error-card">
          <AlertTriangle size={24} className="text-amber-400 shrink-0" />
          <div>
            <h4>History Unavailable</h4>
            <p>{error}</p>
          </div>
        </div>
      ) : !hasActivity ? (
        <div className="report-card">
          <div className="report-empty-state">
            <Calendar size={36} className="text-slate-400 mb-2" />
            <h4 className="text-slate-800 font-semibold">Historical summaries will appear as more financial activity is recorded.</h4>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              Add transactions and income records in Activity to begin building a comprehensive multi-month trendline.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* History Aggregated Summary Hero Card */}
          <div className="report-hero-card">
            <div className="report-hero-header">
              <span className="report-eyebrow-label">LONGITUDINAL PERFORMANCE ({range})</span>
              <span className="report-hero-status-pill">
                {historicalTotals.net >= 0 ? 'Cumulative Surplus' : 'Cumulative Deficit'}
              </span>
            </div>

            <div className="report-hero-main-stat">
              <div className="report-hero-primary-val-wrap">
                <span className="report-hero-currency">₹</span>
                <span className={`report-hero-primary-val tabular-nums ${historicalTotals.net >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {historicalTotals.net >= 0 ? '+' : ''}{historicalTotals.net.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="report-hero-sub-metric">
                Net cash retained across the past {summaries.length} monthly accounting cycles
              </p>
            </div>

            <div className="report-hero-metrics-strip">
              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <TrendingUp size={14} className="text-emerald-500 inline mr-1" />
                  Total Cumulative Inflow
                </span>
                <span className="subitem-val text-emerald-600 tabular-nums">
                  ₹{historicalTotals.income.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <TrendingDown size={14} className="text-rose-500 inline mr-1" />
                  Total Cumulative Outflow
                </span>
                <span className="subitem-val text-rose-600 tabular-nums">
                  ₹{historicalTotals.expenses.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <Percent size={14} className="text-cyan-600 inline mr-1" />
                  Average Savings Rate
                </span>
                <span className="subitem-val text-cyan-600 tabular-nums">
                  {historicalTotals.avgSavingsRate}%
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <CalendarRange size={14} className="text-indigo-600 inline mr-1" />
                  Tracked Cycles
                </span>
                <span className="subitem-val text-indigo-600 tabular-nums">
                  {summaries.length} Months
                </span>
              </div>
            </div>
          </div>

          {/* Chart 1: Income, Expenses & Net Flow */}
          <div className="report-card mb-6">
            <div className="report-card-header">
              <div>
                <span className="report-eyebrow-label">CASH FLOW DYNAMICS</span>
                <h3>Cash Flow &amp; Outflow Trajectory</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Monthly comparison of recorded inflows, expenditures, and resulting surplus or deficit
                </p>
              </div>
              <span className="report-card-badge">Monthly Aggregates</span>
            </div>

            <div className="report-chart-box">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={summaries} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="periodLabel" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<HistoryTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 12, fontSize: 13 }} />
                  <Bar dataKey="totalIncome" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="totalExpenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line
                    type="monotone"
                    dataKey="netCashFlow"
                    name="Net Cash Flow"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0284c7' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Savings Rate & FMI Evolution */}
          <div className="report-sections-grid mb-6">
            {/* Savings Rate Chart */}
            <div className="report-card">
              <div className="report-card-header">
                <div>
                  <span className="report-eyebrow-label">DISCIPLINE METRICS</span>
                  <h3>Historical Savings Rate</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Retained surplus as percentage of income</p>
                </div>
                <span className="report-card-badge">% of Income</span>
              </div>

              <div className="report-chart-box">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={summaries} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="periodLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      domain={[0, 100]}
                      tickLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip content={<HistoryTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="savingsRate"
                      name="Savings Rate"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#06b6d4' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FMI Evolution Chart */}
            <div className="report-card">
              <div className="report-card-header">
                <div>
                  <span className="report-eyebrow-label">PSYCHOLOGICAL INDEX</span>
                  <h3>Average FMI Health Evolution</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Monthly composite index of financial mind</p>
                </div>
                <span className="report-card-badge">Index (0–100)</span>
              </div>

              <div className="report-chart-box">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={summaries} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="periodLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      domain={[40, 100]}
                      tickLine={false}
                    />
                    <Tooltip content={<HistoryTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="fmiAverage"
                      name="Average FMI"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{ r: 4, fill: '#6366f1' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Compact Monthly Report Timeline Cards */}
          <div className="report-card">
            <div className="report-card-header">
              <div>
                <span className="report-eyebrow-label">CYCLE DIRECTORY</span>
                <h3>Monthly Performance Ledger</h3>
              </div>
              <span className="report-card-badge">{timelineCards.length} Cycles</span>
            </div>

            <div className="report-timeline-grid">
              {timelineCards.map((card) => {
                const isNetPos = card.netCashFlow >= 0;
                const hasZeroActivity = card.totalIncome === 0 && card.totalExpenses === 0;

                return (
                  <div key={card.period} className="report-timeline-card">
                    <div className="report-tl-header">
                      <div className="report-tl-month">{card.periodLabel}</div>
                      <button
                        type="button"
                        className="report-tl-inspect-btn no-print"
                        onClick={() => onInspectMonth(card.year, card.month)}
                        title={`Inspect full ${card.periodLabel} report`}
                      >
                        <span>Inspect</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {hasZeroActivity ? (
                      <div className="report-tl-empty-cycle">
                        <span className="text-slate-400 text-xs italic">No activity recorded for this month</span>
                      </div>
                    ) : (
                      <div className="report-tl-stats">
                        <div className="report-tl-stat-row">
                          <span className="label">
                            <TrendingUp size={13} className="text-emerald-500 inline mr-1" />
                            Income
                          </span>
                          <span className="val text-emerald-600 tabular-nums">
                            ₹{card.totalIncome.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="report-tl-stat-row">
                          <span className="label">
                            <TrendingDown size={13} className="text-rose-500 inline mr-1" />
                            Expenses
                          </span>
                          <span className="val text-rose-600 tabular-nums">
                            ₹{card.totalExpenses.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="report-tl-stat-row">
                          <span className="label">
                            <Scale size={13} className={isNetPos ? 'text-emerald-500' : 'text-rose-500'} />
                            {' '}Net Flow
                          </span>
                          <span className={`val tabular-nums ${isNetPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isNetPos ? '+' : ''}₹{card.netCashFlow.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="report-tl-stat-row">
                          <span className="label">Savings Rate</span>
                          <span className="val text-cyan-600 tabular-nums">{card.savingsRate}%</span>
                        </div>

                        <div className="report-tl-stat-row">
                          <span className="label">
                            <ShieldCheck size={13} className="text-indigo-500 inline mr-1" />
                            FMI Avg
                          </span>
                          <span className="val text-indigo-600 tabular-nums">
                            {card.fmiAverage !== null ? card.fmiAverage : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical Scope Notice */}
          <div className="report-footer-bar no-print">
            <div className="report-footer-notice">
              <Info size={16} className="text-cyan-600 shrink-0" />
              <span>
                Historical summaries represent direct mathematical aggregations over user transactions, income,
                and recorded FMI history. Months without recorded activity reflect ₹0 truthfully without synthetic projections.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
