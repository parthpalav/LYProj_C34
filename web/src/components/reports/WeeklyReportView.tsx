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
  Gauge
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WeeklyReport, PacingReport } from '../../types';

interface WeeklyReportViewProps {
  report: WeeklyReport | null;
  pacing: PacingReport | null;
  loading: boolean;
  error: string | null;
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  report,
  pacing,
  loading,
  error
}) => {
  // Calculate past 7 days date range for display
  const periodLabel = React.useMemo(() => {
    const n = new Date();
    const pw = new Date(n.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${pw.toLocaleDateString('en-US', dateOptions)} – ${n.toLocaleDateString('en-US', dateOptions)}`;
  }, []);

  if (loading) {
    return (
      <div className="report-loading-container">
        <div className="spinner" />
        <p>Compiling weekly financial report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="report-error-card">
        <AlertTriangle size={24} className="text-amber-400 shrink-0" />
        <div>
          <h4>Weekly Report Unavailable</h4>
          <p>{error || 'Not enough financial activity yet to generate a meaningful weekly report.'}</p>
        </div>
      </div>
    );
  }

  const netFlow = report.totalIncome - report.totalSpend;
  const isPositiveNet = netFlow >= 0;

  // Calculate weekly spending mix from pacing if available (as pacing tracks actuals for current month cycle)
  const pacingTotal = pacing ? pacing.Needs.actual + pacing.Wants.actual + pacing.Investments.actual : 0;

  return (
    <div className="report-view-container printable-document">
      {/* Editorial Report Header Banner */}
      <div className="report-header-banner">
        <div className="report-header-info">
          <div className="report-type-badge">
            <Calendar size={12} className="inline mr-1" />
            Rolling 7-Day Window
          </div>
          <h2 className="report-title">Weekly Financial Review</h2>
          <p className="report-period-text">{periodLabel}</p>
        </div>
        <button
          className="report-print-btn no-print"
          onClick={() => window.print()}
          title="Print or save as PDF"
          type="button"
        >
          <Printer size={15} />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Hero Review Card */}
      <div className="report-hero-card">
        <div className="report-hero-header">
          <span className="report-eyebrow-label">THIS WEEK'S NET POSITION</span>
          <span className="report-hero-status-pill">
            {isPositiveNet ? 'Cash Surplus' : 'Deficit Outflow'}
          </span>
        </div>

        <div className="report-hero-main-stat">
          <div className="report-hero-primary-val-wrap">
            <span className="report-hero-currency">₹</span>
            <span className={`report-hero-primary-val tabular-nums ${isPositiveNet ? 'text-positive' : 'text-negative'}`}>
              {isPositiveNet ? '+' : ''}{netFlow.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="report-hero-sub-metric">
            {isPositiveNet
              ? 'Retained surplus from past 7 days inflows after meeting expenditures'
              : 'Expenditures exceeded recorded inflows during this 7-day period'}
          </p>
        </div>

        <div className="report-hero-metrics-strip">
          <div className="report-hero-subitem">
            <span className="subitem-label">
              <TrendingUp size={14} className="text-emerald-500 inline mr-1" />
              Recorded Inflows
            </span>
            <span className="subitem-val text-emerald-600 tabular-nums">
              ₹{report.totalIncome.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="report-hero-subitem">
            <span className="subitem-label">
              <TrendingDown size={14} className="text-rose-500 inline mr-1" />
              Recorded Outflows
            </span>
            <span className="subitem-val text-rose-600 tabular-nums">
              ₹{report.totalSpend.toLocaleString('en-IN')}
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
              FMI Snapshot
            </span>
            <span className="subitem-val text-indigo-600 tabular-nums">
              {report.fmiAvg > 0 ? `${report.fmiAvg}/100` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="report-kpi-grid">
        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Weekly Outflow</span>
            <TrendingDown size={16} className="text-rose-500" />
          </div>
          <div className="report-kpi-val text-rose-600 tabular-nums">
            ₹{report.totalSpend.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">Total recorded expenditures</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Weekly Inflow</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="report-kpi-val text-emerald-600 tabular-nums">
            ₹{report.totalIncome.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">Total recorded inflows</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Net Cash Flow</span>
            <Scale size={16} className={isPositiveNet ? 'text-emerald-500' : 'text-rose-500'} />
          </div>
          <div className={`report-kpi-val tabular-nums ${isPositiveNet ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositiveNet ? '+' : ''}₹{netFlow.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">
            {isPositiveNet ? 'Surplus retained this week' : 'Deficit drawn from balance'}
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
          <div className="report-kpi-subtext">Envelope savings share</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">FMI Average</span>
            <ShieldCheck size={16} className="text-indigo-500" />
          </div>
          <div className="report-kpi-val text-indigo-600 tabular-nums">
            {report.fmiAvg > 0 ? report.fmiAvg : '—'}
          </div>
          <div className="report-kpi-subtext">
            {report.fmiAvg >= 75 ? 'Optimal health' : report.fmiAvg > 0 ? 'Diagnostic index' : 'No snapshots'}
          </div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Flagged Anomalies</span>
            <AlertTriangle size={16} className={report.anomalyCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>
          <div className={`report-kpi-val tabular-nums ${report.anomalyCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
            {report.anomalyCount}
          </div>
          <div className="report-kpi-subtext">Out-of-pattern transactions</div>
        </div>
      </div>

      {/* Main Analysis Section: Top Categories & Budget Pacing */}
      <div className="report-sections-grid">
        {/* Top Categories */}
        <div className="report-card">
          <div className="report-card-header">
            <div>
              <span className="report-eyebrow-label">EXPENDITURE RANKING</span>
              <h3>Top Spending Categories</h3>
            </div>
            <span className="report-card-badge">{report.topCategories.length} Categories</span>
          </div>

          {report.topCategories.length === 0 ? (
            <div className="report-empty-state">
              <p>No categorised expenditures recorded this week.</p>
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

        {/* 50/30/20 Budget Pacing */}
        <div className="report-card">
          <div className="report-card-header">
            <div>
              <span className="report-eyebrow-label">BUDGET PACING BENCHMARK</span>
              <h3>Monthly Cycle Pacing</h3>
            </div>
            <span className="report-card-badge flex items-center gap-1">
              <Gauge size={12} /> Target Limits
            </span>
          </div>

          {!pacing ? (
            <div className="report-empty-state">
              <p>Pacing benchmarks currently unavailable.</p>
            </div>
          ) : (
            <div className="report-pacing-list">
              {/* Needs */}
              <div className="report-pacing-row">
                <div className="report-pacing-meta">
                  <div>
                    <div className="report-pacing-name">Essential Needs (50% target)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Needs.actual.toLocaleString('en-IN')} of ₹{pacing.Needs.limit.toLocaleString('en-IN')} limit
                    </div>
                  </div>
                  <span className="report-pacing-status tabular-nums">
                    {pacing.Needs.limit > 0
                      ? `${Math.round((pacing.Needs.actual / pacing.Needs.limit) * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="report-cat-bar-bg">
                  <div
                    className={`report-cat-bar-fill ${
                      pacing.Needs.actual > pacing.Needs.limit ? 'bg-rose-500' : 'bg-cyan-600'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        pacing.Needs.limit > 0 ? (pacing.Needs.actual / pacing.Needs.limit) * 100 : 0
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Wants */}
              <div className="report-pacing-row">
                <div className="report-pacing-meta">
                  <div>
                    <div className="report-pacing-name">Discretionary Wants (30% target)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Wants.actual.toLocaleString('en-IN')} of ₹{pacing.Wants.limit.toLocaleString('en-IN')} limit
                    </div>
                  </div>
                  <span className="report-pacing-status tabular-nums">
                    {pacing.Wants.limit > 0
                      ? `${Math.round((pacing.Wants.actual / pacing.Wants.limit) * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="report-cat-bar-bg">
                  <div
                    className={`report-cat-bar-fill ${
                      pacing.Wants.actual > pacing.Wants.limit ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        pacing.Wants.limit > 0 ? (pacing.Wants.actual / pacing.Wants.limit) * 100 : 0
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Investments */}
              <div className="report-pacing-row">
                <div className="report-pacing-meta">
                  <div>
                    <div className="report-pacing-name">Investments & Savings (20% target)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Investments.actual.toLocaleString('en-IN')} of ₹{pacing.Investments.limit.toLocaleString('en-IN')} target
                    </div>
                  </div>
                  <span className="report-pacing-status tabular-nums">
                    {pacing.Investments.limit > 0
                      ? `${Math.round((pacing.Investments.actual / pacing.Investments.limit) * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="report-cat-bar-bg">
                  <div
                    className="report-cat-bar-fill bg-emerald-500"
                    style={{
                      width: `${Math.min(
                        100,
                        pacing.Investments.limit > 0
                          ? (pacing.Investments.actual / pacing.Investments.limit) * 100
                          : 0
                      )}%`
                    }}
                  />
                </div>
              </div>

              {pacingTotal > 0 && (
                <div className="report-pacing-legend-note">
                  Benchmark limits are derived from your recorded monthly income baseline.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Behavioral Risk Patterns */}
      <div className="report-card">
        <div className="report-card-header">
          <div>
            <span className="report-eyebrow-label">DIAGNOSTIC SURVEILLANCE</span>
            <h3>Detected Weekly Behavioural Patterns</h3>
          </div>
          <span className="report-card-badge">{report.patterns.length} Flagged</span>
        </div>

        {report.patterns.length === 0 ? (
          <div className="report-empty-state">
            <ShieldCheck size={32} className="text-emerald-500 mb-2" />
            <p className="text-slate-800 font-semibold">No behavioral risk patterns detected this week.</p>
            <p className="text-slate-500 text-sm">
              Your spending discipline adhered to healthy baseline thresholds without late-night surges or impulse clusters.
            </p>
          </div>
        ) : (
          <div className="report-patterns-grid">
            {report.patterns.map((pat, idx) => (
              <div key={idx} className="report-pattern-item">
                <div className="report-pattern-header">
                  <span className="report-pattern-title">
                    {pat.emoji ? `${pat.emoji} ` : ''}{pat.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className={`report-severity-badge severity-${pat.severity}`}>
                    {pat.severity.toUpperCase()}
                  </span>
                </div>
                <p className="report-pattern-desc">{pat.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cross-Section Navigation & Scope Notice */}
      <div className="report-footer-bar no-print">
        <div className="report-footer-notice">
          <Info size={16} className="text-cyan-600 shrink-0" />
          <span>
            Weekly metrics evaluate the rolling past 7 days of activity. For calendar month breakdowns and historical trends,
            explore the Monthly or History tabs.
          </span>
        </div>
        <div className="report-footer-links">
          <Link to="/app/activity" className="report-link-action">
            <span>View transactions</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/app/insights?tab=fmi" className="report-link-action">
            <span>Explore FMI details</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};
