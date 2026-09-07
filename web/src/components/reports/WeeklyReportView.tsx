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
  Info
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
        <AlertTriangle size={24} className="text-amber-400" />
        <div>
          <h4>Weekly Report Unavailable</h4>
          <p>{error || 'Not enough financial activity yet to generate a meaningful weekly report.'}</p>
        </div>
      </div>
    );
  }

  const netFlow = report.totalIncome - report.totalSpend;
  const isPositiveNet = netFlow >= 0;

  return (
    <div className="report-view-container printable-document">
      {/* Header Bar */}
      <div className="report-header-banner">
        <div className="report-header-info">
          <div className="report-type-badge">Rolling 7-Day Window</div>
          <h2 className="report-title">Weekly Financial Report</h2>
          <p className="report-period-text">{periodLabel}</p>
        </div>
        <button
          className="report-print-btn no-print"
          onClick={() => window.print()}
          title="Print or save as PDF"
        >
          <Printer size={16} />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="report-kpi-grid">
        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Weekly Outflow</span>
            <TrendingDown size={18} className="text-rose-400" />
          </div>
          <div className="report-kpi-val text-rose-400">
            ₹{report.totalSpend.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">Total recorded expenditures</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Weekly Inflow</span>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div className="report-kpi-val text-emerald-400">
            ₹{report.totalIncome.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">Total recorded inflows</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Net Cash Flow</span>
            <Scale size={18} className={isPositiveNet ? 'text-emerald-400' : 'text-rose-400'} />
          </div>
          <div className={`report-kpi-val ${isPositiveNet ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositiveNet ? '+' : ''}₹{netFlow.toLocaleString('en-IN')}
          </div>
          <div className="report-kpi-subtext">
            {isPositiveNet ? 'Surplus retained this week' : 'Deficit spent from reserves'}
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
          <div className="report-kpi-subtext">Envelope savings share</div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Average FMI</span>
            <ShieldCheck size={18} className="text-indigo-400" />
          </div>
          <div className="report-kpi-val text-indigo-400">
            {report.fmiAvg > 0 ? report.fmiAvg : '—'}
          </div>
          <div className="report-kpi-subtext">
            {report.fmiAvg >= 75 ? 'Optimal health' : report.fmiAvg > 0 ? 'Diagnostic index' : 'No snapshots'}
          </div>
        </div>

        <div className="report-kpi-card">
          <div className="report-kpi-header">
            <span className="report-kpi-label">Flagged Anomalies</span>
            <AlertTriangle size={18} className={report.anomalyCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
          </div>
          <div className={`report-kpi-val ${report.anomalyCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
            {report.anomalyCount}
          </div>
          <div className="report-kpi-subtext">Out-of-pattern transactions</div>
        </div>
      </div>

      {/* Main Analysis Section: 2 Columns */}
      <div className="report-sections-grid">
        {/* Top Categories */}
        <div className="report-card">
          <div className="report-card-header">
            <h3>Top Spending Categories</h3>
            <span className="report-card-badge">{report.topCategories.length} Categories</span>
          </div>

          {report.topCategories.length === 0 ? (
            <div className="report-empty-state">
              <p>No categorised expenditures recorded this week.</p>
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

        {/* 50/30/20 Budget Pacing */}
        <div className="report-card">
          <div className="report-card-header">
            <h3>50/30/20 Spending Pacing</h3>
            <span className="report-card-badge">Monthly Budget Target</span>
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
                    <div className="report-pacing-name">Essential Needs (50%)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Needs.actual.toLocaleString('en-IN')} of ₹{pacing.Needs.limit.toLocaleString('en-IN')} limit
                    </div>
                  </div>
                  <span className="report-pacing-status">
                    {pacing.Needs.limit > 0
                      ? `${Math.round((pacing.Needs.actual / pacing.Needs.limit) * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="report-cat-bar-bg">
                  <div
                    className={`report-cat-bar-fill ${
                      pacing.Needs.actual > pacing.Needs.limit ? 'bg-rose-500' : 'bg-cyan-500'
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
                    <div className="report-pacing-name">Discretionary Wants (30%)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Wants.actual.toLocaleString('en-IN')} of ₹{pacing.Wants.limit.toLocaleString('en-IN')} limit
                    </div>
                  </div>
                  <span className="report-pacing-status">
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
                    <div className="report-pacing-name">Investments & Savings (20%)</div>
                    <div className="report-pacing-details">
                      ₹{pacing.Investments.actual.toLocaleString('en-IN')} of ₹{pacing.Investments.limit.toLocaleString('en-IN')} target
                    </div>
                  </div>
                  <span className="report-pacing-status">
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
            </div>
          )}
        </div>
      </div>

      {/* Behavioral Risk Patterns */}
      <div className="report-card">
        <div className="report-card-header">
          <h3>Detected Weekly Behavioural Patterns</h3>
          <span className="report-card-badge">{report.patterns.length} Flagged</span>
        </div>

        {report.patterns.length === 0 ? (
          <div className="report-empty-state">
            <ShieldCheck size={32} className="text-emerald-400 mb-2" />
            <p className="text-slate-300 font-medium">No behavioral risk patterns detected this week.</p>
            <p className="text-slate-400 text-sm">
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
          <Info size={16} className="text-cyan-400 shrink-0" />
          <span>
            Weekly metrics evaluate the past 7 days of activity. For calendar month breakdowns and historical trends,
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
