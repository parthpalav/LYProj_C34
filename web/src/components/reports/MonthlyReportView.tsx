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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Layers
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

  const currentIndex = availableMonths.findIndex((m) => m.period === currentPeriodKey);
  const canGoPrev = currentIndex < availableMonths.length - 1; // Available months sorted desc (newest first)
  const canGoNext = currentIndex > 0;

  const handlePrev = () => {
    if (canGoPrev && availableMonths[currentIndex + 1]) {
      const target = availableMonths[currentIndex + 1];
      onSelectPeriod(target.year, target.month);
    }
  };

  const handleNext = () => {
    if (canGoNext && availableMonths[currentIndex - 1]) {
      const target = availableMonths[currentIndex - 1];
      onSelectPeriod(target.year, target.month);
    }
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pKey = e.target.value;
    const found = availableMonths.find((m) => m.period === pKey);
    if (found) {
      onSelectPeriod(found.year, found.month);
    }
  };

  const isNetPositive = (report?.netCashFlow ?? 0) >= 0;

  return (
    <div className="report-view-container printable-document">
      {/* Month Selector Header */}
      <div className="report-header-banner">
        <div className="report-header-info">
          <div className="report-type-badge">
            <Calendar size={12} className="inline mr-1" />
            Calendar Month Accounting
          </div>
          <h2 className="report-title">
            {report?.periodLabel || `Report for ${currentPeriodKey}`}
          </h2>
          <p className="report-period-text">
            {report
              ? `${new Date(report.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – ${new Date(new Date(report.endDate).getTime() - 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ''}
          </p>
        </div>

        <div className="report-header-actions no-print">
          {/* Quick Prev / Next Navigator & Native Dropdown */}
          <div className="report-month-picker-combo">
            <button
              type="button"
              className="report-nav-chevron-btn"
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous available month"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="report-period-select-wrap">
              <Calendar size={15} className="report-period-icon" />
              <select
                className="report-period-select"
                value={currentPeriodKey}
                onChange={handlePeriodChange}
                aria-label="Select calendar month"
              >
                {availableMonths.map((m) => (
                  <option key={m.period} value={m.period}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="report-nav-chevron-btn"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next available month"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            className="report-print-btn"
            onClick={() => window.print()}
            title="Print or save as PDF"
            type="button"
          >
            <Printer size={15} />
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
          <AlertTriangle size={24} className="text-amber-400 shrink-0" />
          <div>
            <h4>Monthly Report Unavailable</h4>
            <p>{error || 'No financial activity was recorded for this month.'}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Executive Monthly Hero Review Card */}
          <div className="report-hero-card">
            <div className="report-hero-header">
              <span className="report-eyebrow-label">{report.periodLabel.toUpperCase()} REVIEW</span>
              <span className="report-hero-status-pill">
                {isNetPositive ? 'Monthly Surplus' : 'Monthly Deficit'}
              </span>
            </div>

            <div className="report-hero-main-stat">
              <div className="report-hero-primary-val-wrap">
                <span className="report-hero-currency">₹</span>
                <span className={`report-hero-primary-val tabular-nums ${isNetPositive ? 'text-positive' : 'text-negative'}`}>
                  {isNetPositive ? '+' : ''}{report.netCashFlow.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="report-hero-sub-metric">
                {isNetPositive
                  ? `Retained surplus across ${report.incomeCount} income event${report.incomeCount === 1 ? '' : 's'} and ${report.transactionCount} transaction${report.transactionCount === 1 ? '' : 's'}`
                  : `Net deficit drawn from existing balances during ${report.periodLabel}`}
              </p>
            </div>

            <div className="report-hero-metrics-strip">
              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <TrendingUp size={14} className="text-emerald-500 inline mr-1" />
                  Monthly Inflow
                </span>
                <span className="subitem-val text-emerald-600 tabular-nums">
                  ₹{report.totalIncome.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <TrendingDown size={14} className="text-rose-500 inline mr-1" />
                  Monthly Outflow
                </span>
                <span className="subitem-val text-rose-600 tabular-nums">
                  ₹{report.totalExpenses.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <Percent size={14} className="text-cyan-600 inline mr-1" />
                  Savings Rate
                </span>
                <span className="subitem-val text-cyan-600 tabular-nums">
                  {report.savingsRate}%
                </span>
              </div>

              <div className="report-hero-subitem">
                <span className="subitem-label">
                  <ShieldCheck size={14} className="text-indigo-600 inline mr-1" />
                  Monthly FMI
                </span>
                <span className="subitem-val text-indigo-600 tabular-nums">
                  {report.fmi.average !== null ? `${report.fmi.average}/100` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="report-kpi-grid">
            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly Inflow</span>
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <div className="report-kpi-val text-emerald-600 tabular-nums">
                ₹{report.totalIncome.toLocaleString('en-IN')}
              </div>
              <div className="report-kpi-subtext">
                {report.incomeCount} income {report.incomeCount === 1 ? 'event' : 'events'}
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly Outflow</span>
                <TrendingDown size={16} className="text-rose-500" />
              </div>
              <div className="report-kpi-val text-rose-600 tabular-nums">
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
                  size={16}
                  className={report.netCashFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                />
              </div>
              <div
                className={`report-kpi-val tabular-nums ${
                  report.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
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
                <Percent size={16} className="text-cyan-600" />
              </div>
              <div className="report-kpi-val text-cyan-600 tabular-nums">
                {report.savingsRate}%
              </div>
              <div className="report-kpi-subtext">Retained cash flow ratio</div>
            </div>

            <div className="report-kpi-card">
              <div className="report-kpi-header">
                <span className="report-kpi-label">Monthly FMI</span>
                <ShieldCheck size={16} className="text-indigo-500" />
              </div>
              <div className="report-kpi-val text-indigo-600 tabular-nums">
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
                  size={16}
                  className={report.anomalies.count > 0 ? 'text-amber-500' : 'text-slate-400'}
                />
              </div>
              <div
                className={`report-kpi-val tabular-nums ${
                  report.anomalies.count > 0 ? 'text-amber-600' : 'text-slate-700'
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
              <div>
                <span className="report-eyebrow-label">EXPENDITURE CLASSIFICATION</span>
                <h3>Monthly Spending Mix</h3>
              </div>
              <span className="report-card-badge flex items-center gap-1">
                <Layers size={12} /> Classification Taxonomy
              </span>
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

                {/* Legend & Breakdown Cards */}
                <div className="report-mix-legend-grid">
                  <div className="report-mix-legend-item">
                    <div className="report-mix-legend-indicator dot-needs" />
                    <div className="report-mix-legend-meta">
                      <div className="report-mix-legend-label">Essential Needs</div>
                      <div className="report-mix-legend-val tabular-nums">
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
                      <div className="report-mix-legend-val tabular-nums">
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
                      <div className="report-mix-legend-val tabular-nums">
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
                <div>
                  <span className="report-eyebrow-label">CATEGORY RANKING</span>
                  <h3>Monthly Category Breakdown</h3>
                </div>
                <span className="report-card-badge">{report.topCategories.length} Categories</span>
              </div>

              {report.topCategories.length === 0 ? (
                <div className="report-empty-state">
                  <p>No categorised expenditures recorded for this month.</p>
                </div>
              ) : (
                <div className="report-categories-list">
                  {report.topCategories.map((cat, idx) => (
                    <div key={cat.category} className="report-category-row">
                      <div className="report-cat-meta">
                        <div className="flex items-center gap-2">
                          <span className="report-cat-rank">#{idx + 1}</span>
                          <span className="report-cat-name">{cat.category}</span>
                        </div>
                        <div className="report-cat-amounts">
                          <span className="report-cat-val tabular-nums">₹{cat.amount.toLocaleString('en-IN')}</span>
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
                <div>
                  <span className="report-eyebrow-label">DIAGNOSTIC MOMENTUM</span>
                  <h3>Financial Mind Index (FMI)</h3>
                </div>
                <span className="report-card-badge">Monthly Evolution</span>
              </div>

              {!report.fmi.hasSnapshots ? (
                <div className="report-empty-state">
                  <ShieldCheck size={28} className="text-slate-400 mb-2" />
                  <p className="text-slate-700 font-semibold">No FMI snapshots recorded for this period.</p>
                  <p className="text-slate-500 text-sm">
                    FMI snapshots are evaluated and recorded automatically as transactions and income occur.
                  </p>
                </div>
              ) : (
                <div className="report-fmi-monthly-details">
                  <div className="report-fmi-stat-box">
                    <div className="report-fmi-box-label">Monthly Average Score</div>
                    <div className="report-fmi-box-score tabular-nums">{report.fmi.average} / 100</div>
                    <div className="report-fmi-box-sub">
                      Based on {report.fmi.snapshotCount} snapshot{report.fmi.snapshotCount === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="report-fmi-progression-row">
                    <div className="report-fmi-prog-item">
                      <span className="label">Month Start</span>
                      <span className="score tabular-nums">{report.fmi.first ?? '—'}</span>
                    </div>
                    <div className="report-fmi-prog-arrow">→</div>
                    <div className="report-fmi-prog-item">
                      <span className="label">Month End</span>
                      <span className="score tabular-nums">{report.fmi.last ?? '—'}</span>
                    </div>
                    <div className="report-fmi-prog-item">
                      <span className="label">Score Movement</span>
                      {report.fmi.change !== null ? (
                        <span
                          className={`badge ${
                            report.fmi.change >= 0 ? 'badge-positive' : 'badge-negative'
                          } tabular-nums`}
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
                      <p className="text-slate-500 text-xs">
                        Zero anomalous spending events flagged during this month.
                      </p>
                    ) : (
                      <div className="report-anomalies-list">
                        {report.anomalies.items.map((anom) => (
                          <div key={anom.id} className="report-anomaly-item">
                            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                            <div className="report-anomaly-meta">
                              <span className="desc">{anom.description || 'Unnamed transaction'}</span>
                              <span className="cat">{anom.category}</span>
                            </div>
                            <span className="amount tabular-nums">₹{anom.amount.toLocaleString('en-IN')}</span>
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
              <Info size={16} className="text-cyan-600 shrink-0" />
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
