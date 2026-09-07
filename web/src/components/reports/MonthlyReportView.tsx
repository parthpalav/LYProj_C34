import React from 'react';
import {
  TrendingDown,
  TrendingUp,
  Scale,
  Percent,
  ShieldCheck,
  AlertTriangle,
  Printer,
  ArrowRight,
  Info,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MonthlyReport } from '../../types';
import type { AvailableMonth } from '../../hooks/useMonthlyReport';

interface MonthlyReportViewProps {
  report: MonthlyReport | null;
  loading: boolean;
  error: string | null;
  selectedYear: number;
  selectedMonth: number;
  availableMonths: AvailableMonth[];
  onSelectPeriod: (year: number, month: number) => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  report,
  loading,
  error,
  selectedYear,
  selectedMonth,
  availableMonths,
  onSelectPeriod
}) => {
  const currentPeriodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pKey = e.target.value;
    const found = availableMonths.find((m) => m.period === pKey);
    if (found) {
      onSelectPeriod(found.year, found.month);
    }
  };

  return (
    <div className="report-view-container printable-document">
      {/* Month Selector Header */}
      <div className="report-header-banner">
        <div className="report-header-info">
          <div className="report-type-badge">Monthly Accounting Ledger</div>
          <h2 className="report-title">
            {report?.periodLabel || `Report for ${currentPeriodKey}`}
          </h2>
          <p className="report-period-text">
            {report ? `${new Date(report.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – ${new Date(new Date(report.endDate).getTime() - 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
        </div>

        <div className="report-header-actions no-print">
          {/* Native Dropdown Selector */}
          <div className="report-period-select-wrap">
            <Calendar size={16} className="report-period-icon" />
            <select
              className="report-period-select"
              value={currentPeriodKey}
              onChange={handlePeriodChange}
              aria-label="Select month"
            >
              {availableMonths.map((m) => (
                <option key={m.period} value={m.period}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="report-print-btn"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <Printer size={16} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="report-loading-container">
          <div className="spinner" />
          <p>Compiling monthly report for {report?.periodLabel || currentPeriodKey}...</p>
        </div>
      ) : error || !report ? (
        <div className="report-error-card">
          <AlertTriangle size={24} className="text-amber-400" />
          <div>
            <h4>Monthly Report Unavailable</h4>
            <p>{error || 'No financial activity was recorded for this month.'}</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div className="report-kpi-grid">
            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly Inflow</span>
                <TrendingUp size={18} className="text-emerald-400" />
              </div>
              <div className="report-kpi-val text-emerald-400">
                ₹{report.totalIncome.toLocaleString('en-IN')}
              </div>
              <div className="report-kpi-subtext">
                {report.incomeCount} income {report.incomeCount === 1 ? 'event' : 'events'}
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly Outflow</span>
                <TrendingDown size={18} className="text-rose-400" />
              </div>
              <div className="report-kpi-val text-rose-400">
                ₹{report.totalExpenses.toLocaleString('en-IN')}
              </div>
              <div className="report-kpi-subtext">
                {report.transactionCount} {report.transactionCount === 1 ? 'transaction' : 'transactions'}
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Net Cash Flow</span>
                <Scale
                  size={18}
                  className={report.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                />
              </div>
              <div
                className={`report-kpi-val ${
                  report.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report.netCashFlow >= 0 ? '+' : ''}₹{report.netCashFlow.toLocaleString('en-IN')}
              </div>
              <div className="report-kpi-subtext">
                {report.netCashFlow >= 0 ? 'Surplus added to wealth' : 'Deficit drawn from reserves'}
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Savings Rate</span>
                <Percent size={18} className="text-cyan-400" />
              </div>
              <div className="report-kpi-val text-cyan-400">
                {report.savingsRate}%
              </div>
              <div className="report-kpi-subtext">Retained cash flow ratio</div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly FMI</span>
                <ShieldCheck size={18} className="text-indigo-400" />
              </div>
              <div className="report-kpi-val text-indigo-400">
                {report.fmi.average !== null ? report.fmi.average : '—'}
              </div>
              <div className="report-kpi-subtext">
                {report.fmi.snapshotCount > 0
                  ? `${report.fmi.snapshotCount} recorded snapshot${report.fmi.snapshotCount === 1 ? '' : 's'}`
                  : 'No snapshots recorded'}
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Flagged Anomalies</span>
                <AlertTriangle
                  size={18}
                  className={report.anomalies.count > 0 ? 'text-amber-400' : 'text-slate-400'}
                />
              </div>
              <div
                className={`report-kpi-val ${
                  report.anomalies.count > 0 ? 'text-amber-400' : 'text-slate-200'
                }`}
              >
                {report.anomalies.count}
              </div>
              <div className="report-kpi-subtext">Behavioral spikes</div>
            </div>
          </div>

          {/* Spending Mix: Needs / Wants / Investments */}
          <div className="report-card mb-6">
            <div className="report-card-header">
              <h3>Monthly Spending Mix</h3>
              <span className="report-card-badge">Classification Taxonomy</span>
            </div>

            {report.totalExpenses === 0 ? (
              <div className="report-empty-state">
                <p>No expenditure recorded for this calendar month.</p>
              </div>
            ) : (
              <div className="report-spending-mix-content">
                {/* Horizontal Segmented Bar */}
                <div className="report-mix-bar-track">
                  {report.spendingMix.Needs > 0 && (
                    <div
                      className="report-mix-segment mix-needs"
                      style={{
                        width: `${(report.spendingMix.Needs / report.totalExpenses) * 100}%`
                      }}
                      title={`Needs: ₹${report.spendingMix.Needs.toLocaleString('en-IN')}`}
                    />
                  )}
                  {report.spendingMix.Wants > 0 && (
                    <div
                      className="report-mix-segment mix-wants"
                      style={{
                        width: `${(report.spendingMix.Wants / report.totalExpenses) * 100}%`
                      }}
                      title={`Wants: ₹${report.spendingMix.Wants.toLocaleString('en-IN')}`}
                    />
                  )}
                  {report.spendingMix.Investments > 0 && (
                    <div
                      className="report-mix-segment mix-investments"
                      style={{
                        width: `${(report.spendingMix.Investments / report.totalExpenses) * 100}%`
                      }}
                      title={`Investments: ₹${report.spendingMix.Investments.toLocaleString('en-IN')}`}
                    />
                  )}
                </div>

                {/* Legend & Breakdown */}
                <div className="report-mix-legend-grid">
                  <div className="report-mix-legend-item">
                    <div className="report-mix-legend-indicator dot-needs" />
                    <div className="report-mix-legend-meta">
                      <div className="report-mix-legend-label">Essential Needs</div>
                      <div className="report-mix-legend-val">
                        ₹{report.spendingMix.Needs.toLocaleString('en-IN')}{' '}
                        <span className="text-slate-400 font-normal">
                          ({Math.round((report.spendingMix.Needs / report.totalExpenses) * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="report-mix-legend-item">
                    <div className="report-mix-legend-indicator dot-wants" />
                    <div className="report-mix-legend-meta">
                      <div className="report-mix-legend-label">Discretionary Wants</div>
                      <div className="report-mix-legend-val">
                        ₹{report.spendingMix.Wants.toLocaleString('en-IN')}{' '}
                        <span className="text-slate-400 font-normal">
                          ({Math.round((report.spendingMix.Wants / report.totalExpenses) * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="report-mix-legend-item">
                    <div className="report-mix-legend-indicator dot-investments" />
                    <div className="report-mix-legend-meta">
                      <div className="report-mix-legend-label">Investments</div>
                      <div className="report-mix-legend-val">
                        ₹{report.spendingMix.Investments.toLocaleString('en-IN')}{' '}
                        <span className="text-slate-400 font-normal">
                          ({Math.round((report.spendingMix.Investments / report.totalExpenses) * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2 Columns: Category Breakdown & FMI Snapshot Analysis */}
          <div className="report-sections-grid">
            {/* Top Categories */}
            <div className="report-card">
              <div className="report-card-header">
                <h3>Monthly Category Breakdown</h3>
                <span className="report-card-badge">{report.topCategories.length} Categories</span>
              </div>

              {report.topCategories.length === 0 ? (
                <div className="report-empty-state">
                  <p>No categorised expenditures recorded for this month.</p>
                </div>
              ) : (
                <div className="report-categories-list">
                  {report.topCategories.map((cat) => (
                    <div key={cat.category} className="report-category-row">
                      <div className="report-cat-meta">
                        <span className="report-cat-name">{cat.category}</span>
                        <div className="report-cat-amounts">
                          <span className="report-cat-val">₹{cat.amount.toLocaleString('en-IN')}</span>
                          <span className="report-cat-pct">({cat.pct}%)</span>
                        </div>
                      </div>
                      <div className="report-cat-bar-bg">
                        <div
                          className="report-cat-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, cat.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FMI & Anomalies Card */}
            <div className="report-card">
              <div className="report-card-header">
                <h3>Financial Mind Index (FMI) Diagnostic</h3>
                <span className="report-card-badge">Monthly Evolution</span>
              </div>

              {!report.fmi.hasSnapshots ? (
                <div className="report-empty-state">
                  <ShieldCheck size={28} className="text-slate-400 mb-2" />
                  <p className="text-slate-300 font-medium">No FMI snapshots recorded for this period.</p>
                  <p className="text-slate-400 text-sm">
                    FMI snapshots are evaluated and recorded automatically as transactions and income occur.
                  </p>
                </div>
              ) : (
                <div className="report-fmi-monthly-details">
                  <div className="report-fmi-stat-box">
                    <div className="report-fmi-box-label">Monthly Average Score</div>
                    <div className="report-fmi-box-score">{report.fmi.average} / 100</div>
                    <div className="report-fmi-box-sub">
                      Based on {report.fmi.snapshotCount} snapshot{report.fmi.snapshotCount === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="report-fmi-progression-row">
                    <div className="report-fmi-prog-item">
                      <span className="label">Month Start</span>
                      <span className="score">{report.fmi.first ?? '—'}</span>
                    </div>
                    <div className="report-fmi-prog-arrow">→</div>
                    <div className="report-fmi-prog-item">
                      <span className="label">Month End</span>
                      <span className="score">{report.fmi.last ?? '—'}</span>
                    </div>
                    <div className="report-fmi-prog-item">
                      <span className="label">Score Movement</span>
                      {report.fmi.change !== null ? (
                        <span
                          className={`badge ${
                            report.fmi.change >= 0 ? 'badge-positive' : 'badge-negative'
                          }`}
                        >
                          {report.fmi.change >= 0 ? `+${report.fmi.change}` : report.fmi.change} pts
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          Single snapshot recorded; change cannot be determined.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Anomalies List */}
                  <div className="report-anomalies-section">
                    <h4 className="report-subheading">Flagged Behavioral Anomalies</h4>
                    {report.anomalies.count === 0 ? (
                      <p className="text-slate-400 text-xs">
                        Zero anomalous spending events flagged during this month.
                      </p>
                    ) : (
                      <div className="report-anomalies-list">
                        {report.anomalies.items.map((anom) => (
                          <div key={anom.id} className="report-anomaly-item">
                            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                            <div className="report-anomaly-meta">
                              <span className="desc">{anom.description || 'Unnamed transaction'}</span>
                              <span className="cat">{anom.category}</span>
                            </div>
                            <span className="amount">₹{anom.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cross-Section Navigation & Scope Notice */}
          <div className="report-footer-bar no-print">
            <div className="report-footer-notice">
              <Info size={16} className="text-cyan-400 shrink-0" />
              <span>
                Monthly report aggregates are compiled directly from recorded ledger documents. No synthetic
                past balances or simulated data are applied.
              </span>
            </div>
            <div className="report-footer-links">
              <Link to="/app/activity" className="report-link-action">
                <span>View transactions</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/plan?tab=fire" className="report-link-action">
                <span>Open FIRE planning</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
