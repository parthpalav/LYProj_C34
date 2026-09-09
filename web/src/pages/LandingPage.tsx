import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  TrendingUp,
  Smartphone,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  Target,
  Clock,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LandingPage: React.FC = () => {
  return (
    <div className="landing-page-root">
      {/* Navigation Header */}
      <header className="landing-nav-header">
        <div className="landing-nav-container">
          <div className="landing-nav-brand">
            <div className="landing-brand-icon" aria-hidden="true">
              F
            </div>
            <span className="landing-brand-name">
              FINAURA
            </span>
          </div>

          <div className="landing-nav-actions">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="landing-main-content">
        {/* HERO SECTION */}
        <section className="landing-hero-section">
          <div className="landing-hero-grid">
            {/* Hero Left: Value Positioning */}
            <div className="landing-hero-text">
              <div className="landing-hero-eyebrow hero-stagger-1">
                <Sparkles size={14} className="landing-eyebrow-icon" aria-hidden="true" />
                <span>Financial Intelligence Platform</span>
              </div>

              <h1 className="landing-hero-title hero-stagger-2">
                Your finances,<br />finally in focus.
              </h1>

              <p className="landing-hero-desc hero-stagger-3">
                Understand your financial behavior, track disciplined cash flow, and navigate your long-term independence with explainable diagnostics and deterministic planning.
              </p>

              <div className="landing-hero-actions hero-stagger-4">
                <Link to="/register">
                  <Button size="lg" variant="primary" rightIcon={<ArrowRight size={16} />}>
                    Get Started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg">
                    Sign In to Portal
                  </Button>
                </Link>
              </div>

              <div className="landing-hero-trust hero-stagger-4">
                <div className="landing-trust-item">
                  <CheckCircle2 size={16} className="landing-trust-icon" aria-hidden="true" />
                  <span>Explainable Diagnostics</span>
                </div>
                <div className="landing-trust-item">
                  <CheckCircle2 size={16} className="landing-trust-icon" aria-hidden="true" />
                  <span>Single-Count Accounting</span>
                </div>
                <div className="landing-trust-item">
                  <CheckCircle2 size={16} className="landing-trust-icon" aria-hidden="true" />
                  <span>Deterministic Modeling</span>
                </div>
              </div>
            </div>

            {/* Hero Right: Interactive-Looking Product Preview */}
            <div className="landing-hero-preview-wrap hero-stagger-3" aria-hidden="true">
              <div className="landing-preview-ambient-glow" />
              <div className="landing-preview-card">
                {/* Preview Window Header */}
                <div className="landing-preview-window-head">
                  <div className="landing-preview-head-left">
                    <div className="landing-window-dots">
                      <span className="window-dot dot-red" />
                      <span className="window-dot dot-yellow" />
                      <span className="window-dot dot-green" />
                    </div>
                    <span className="landing-preview-platform-title">
                      FINAURA Intelligence Dashboard
                    </span>
                  </div>
                  <span className="landing-preview-watermark-pill">
                    Illustrative preview
                  </span>
                </div>

                {/* Primary Anchor: Operating Balance */}
                <div className="landing-preview-balance-block">
                  <div className="landing-preview-block-header">
                    <span className="landing-preview-sublabel">Operating Position</span>
                    <span className="landing-preview-chip chip-surplus">+₹28,800 Net Surplus</span>
                  </div>
                  <div className="landing-preview-balance-val tabular-nums">
                    ₹2,48,500
                  </div>
                  <div className="landing-preview-balance-sub">
                    Reconciled liquid balance across operating accounts
                  </div>
                </div>

                {/* Diagnostic Grid: FMI + FIRE Targets */}
                <div className="landing-preview-tiles-grid">
                  {/* Tile 1: FMI Diagnostic */}
                  <div className="landing-preview-tile">
                    <div className="landing-tile-header">
                      <div className="landing-tile-icon-wrap icon-fmi">
                        <Activity size={15} />
                      </div>
                      <span className="landing-tile-label">FMI Score</span>
                    </div>
                    <div className="landing-tile-score-row">
                      <span className="landing-tile-score-val tabular-nums">78</span>
                      <span className="landing-tile-score-denom">/ 100</span>
                      <span className="landing-tile-status-badge status-good">Good</span>
                    </div>
                    <div className="landing-tile-pillars-summary">
                      <div className="landing-pillar-weight-bar">
                        <div className="weight-segment seg-d1" style={{ width: '40%' }} title="D1 Saving Discipline (40% weight)" />
                        <div className="weight-segment seg-d2" style={{ width: '30%' }} title="D2 Spending Control (30% weight)" />
                        <div className="weight-segment seg-d3" style={{ width: '30%' }} title="D3 Behavioral Risk (30% weight)" />
                      </div>
                      <div className="landing-pillar-weight-labels">
                        <span>D1: 40% wt</span>
                        <span>D2: 30% wt</span>
                        <span>D3: 30% wt</span>
                      </div>
                    </div>
                  </div>

                  {/* Tile 2: Retirement / FIRE Target */}
                  <div className="landing-preview-tile">
                    <div className="landing-tile-header">
                      <div className="landing-tile-icon-wrap icon-fire">
                        <Target size={15} />
                      </div>
                      <span className="landing-tile-label">Retirement Target</span>
                    </div>
                    <div className="landing-tile-score-row">
                      <span className="landing-tile-score-val tabular-nums">₹1.20 Cr</span>
                    </div>
                    <div className="landing-tile-subtext">
                      Illustrative trajectory · 6 Months liquid runway
                    </div>
                  </div>
                </div>

                {/* Cash Flow Sparkline / Breakdown Bar */}
                <div className="landing-preview-flow-strip">
                  <div className="landing-flow-strip-header">
                    <span className="landing-flow-title">Current Month Flow Taxonomy</span>
                    <span className="landing-flow-ratio">Inflow: ₹85,000 · Outflow: ₹56,200</span>
                  </div>
                  <div className="landing-flow-taxonomy-bar">
                    <div className="flow-seg seg-needs" style={{ width: '48%' }}>
                      <span>Needs 48%</span>
                    </div>
                    <div className="flow-seg seg-wants" style={{ width: '22%' }}>
                      <span>Wants 22%</span>
                    </div>
                    <div className="flow-seg seg-invest" style={{ width: '30%' }}>
                      <span>Invest 30%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THREE EDITORIAL PRODUCT NARRATIVE SECTIONS */}
        <section className="landing-editorial-section">
          <div className="landing-container">
            <div className="landing-section-intro">
              <span className="landing-section-eyebrow">Product Architecture</span>
              <h2 className="landing-section-heading">
                Three Pillars of Financial Intelligence
              </h2>
              <p className="landing-section-subtitle">
                A connected ecosystem linking daily discretionary choices directly to lifelong financial autonomy.
              </p>
            </div>

            {/* Narrative 1: UNDERSTAND (Text Left, Visual Right) */}
            <div className="landing-narrative-row">
              <div className="landing-narrative-copy">
                <div className="landing-narrative-icon-badge">
                  <Activity size={20} />
                </div>
                <span className="landing-narrative-tag">01 · Understand</span>
                <h3 className="landing-narrative-title">
                  Explainable behavioral analysis, not black-box scores.
                </h3>
                <p className="landing-narrative-desc">
                  The Financial Momentum Index (FMI) measures financial discipline across three weighted dimensions. Instead of an opaque score, FINAURA explains exactly what influenced your momentum—whether it was high discretionary spending, impulse transactions, or an accelerated savings rate.
                </p>
                <ul className="landing-narrative-checklist">
                  <li>Transparent 40% / 30% / 30% pillar weight distribution</li>
                  <li>Real-time classification into Needs, Wants, and Investments</li>
                  <li>Automated behavioral risk detection and habit nudges</li>
                </ul>
              </div>

              <div className="landing-narrative-visual" aria-hidden="true">
                <div className="landing-visual-card">
                  <div className="landing-visual-card-head">
                    <span className="landing-visual-title">Financial Momentum Index (FMI) Diagnostic</span>
                    <span className="landing-preview-watermark-pill">Sample diagnostic</span>
                  </div>

                  <div className="landing-fmi-hero-display">
                    <div className="landing-fmi-score-circle">
                      <span className="landing-fmi-big-score tabular-nums">78</span>
                      <span className="landing-fmi-scale">/ 100</span>
                    </div>
                    <div className="landing-fmi-meta">
                      <span className="landing-fmi-status-pill">Good Momentum</span>
                      <p className="landing-fmi-note">
                        Discretionary spending is well-controlled with consistent monthly savings discipline.
                      </p>
                    </div>
                  </div>

                  <div className="landing-fmi-pillars-list">
                    <div className="landing-fmi-pillar-row">
                      <div className="landing-fmi-pillar-labels">
                        <span className="pillar-name">D1 · Saving Discipline</span>
                        <span className="pillar-meta">40% weight · Score 82</span>
                      </div>
                      <div className="landing-pillar-progress-track">
                        <div className="landing-pillar-progress-fill fill-green" style={{ width: '82%' }} />
                      </div>
                    </div>

                    <div className="landing-fmi-pillar-row">
                      <div className="landing-fmi-pillar-labels">
                        <span className="pillar-name">D2 · Spending Control</span>
                        <span className="pillar-meta">30% weight · Score 75</span>
                      </div>
                      <div className="landing-pillar-progress-track">
                        <div className="landing-pillar-progress-fill fill-blue" style={{ width: '75%' }} />
                      </div>
                    </div>

                    <div className="landing-fmi-pillar-row">
                      <div className="landing-fmi-pillar-labels">
                        <span className="pillar-name">D3 · Behavioral Risk</span>
                        <span className="pillar-meta">30% weight · Score 76</span>
                      </div>
                      <div className="landing-pillar-progress-track">
                        <div className="landing-pillar-progress-fill fill-amber" style={{ width: '76%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Narrative 2: PLAN (Visual Left, Text Right) */}
            <div className="landing-narrative-row landing-narrative-reverse">
              <div className="landing-narrative-copy">
                <div className="landing-narrative-icon-badge">
                  <TrendingUp size={20} />
                </div>
                <span className="landing-narrative-tag">02 · Plan</span>
                <h3 className="landing-narrative-title">
                  Deterministic forecasting for lifelong independence.
                </h3>
                <p className="landing-narrative-desc">
                  Eliminate guesswork with math-grounded retirement models. FINAURA computes your exact Financial Independence (FIRE) target corpus, solves for required monthly investments, and tests resilience against unexpected expenses.
                </p>
                <ul className="landing-narrative-checklist">
                  <li>Inflation-adjusted baseline and step-up solver</li>
                  <li>Emergency fund runway tracking liquid reserves</li>
                  <li>Scenario Lab with Base, Conservative, and Growth projections</li>
                </ul>
              </div>

              <div className="landing-narrative-visual" aria-hidden="true">
                <div className="landing-visual-card">
                  <div className="landing-visual-card-head">
                    <span className="landing-visual-title">Scenario Lab & FIRE Planning</span>
                    <span className="landing-preview-watermark-pill">Sample planning view</span>
                  </div>

                  <div className="landing-plan-kpis-grid">
                    <div className="landing-plan-kpi">
                      <span className="plan-kpi-label">Known Net Worth</span>
                      <span className="plan-kpi-val tabular-nums">₹48,20,000</span>
                      <span className="plan-kpi-sub">Assets less liabilities</span>
                    </div>
                    <div className="landing-plan-kpi">
                      <span className="plan-kpi-label">Target FIRE Corpus</span>
                      <span className="plan-kpi-val tabular-nums">₹1.20 Cr</span>
                      <span className="plan-kpi-sub">Illustrative trajectory</span>
                    </div>
                  </div>

                  <div className="landing-scenario-bars-box">
                    <span className="scenario-box-title">Multi-Horizon Projection Models</span>
                    <div className="scenario-item">
                      <div className="scenario-item-head">
                        <span className="scenario-tag tag-base">Base Plan</span>
                        <span className="scenario-val tabular-nums">₹1.35 Cr at retirement</span>
                      </div>
                      <div className="scenario-track">
                        <div className="scenario-fill fill-indigo" style={{ width: '88%' }} />
                      </div>
                    </div>
                    <div className="scenario-item">
                      <div className="scenario-item-head">
                        <span className="scenario-tag tag-conservative">Conservative Buffer</span>
                        <span className="scenario-val tabular-nums">₹1.10 Cr at retirement</span>
                      </div>
                      <div className="scenario-track">
                        <div className="scenario-fill fill-amber" style={{ width: '72%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Narrative 3: TRACK (Text Left, Visual Right) */}
            <div className="landing-narrative-row">
              <div className="landing-narrative-copy">
                <div className="landing-narrative-icon-badge">
                  <Receipt size={20} />
                </div>
                <span className="landing-narrative-tag">03 · Track</span>
                <h3 className="landing-narrative-title">
                  Disciplined accounting and time-series reports.
                </h3>
                <p className="landing-narrative-desc">
                  Every rupee counts once, and only once. Our strict single-count accounting prevents double-counting transfers across investments, debts, and savings. Scheduled obligations are automatically tracked with due dates and payment reconciliation.
                </p>
                <ul className="landing-narrative-checklist">
                  <li>Automated liability scheduler with auto-deduction detection</li>
                  <li>Weekly, monthly, and historical performance reporting</li>
                  <li>Clean exportable audit statements in CSV and formatted print</li>
                </ul>
              </div>

              <div className="landing-narrative-visual" aria-hidden="true">
                <div className="landing-visual-card">
                  <div className="landing-visual-card-head">
                    <span className="landing-visual-title">Scheduled Obligations & Ledger</span>
                    <span className="landing-preview-watermark-pill">Sample ledger</span>
                  </div>

                  <div className="landing-ledger-sample-list">
                    <div className="landing-ledger-row">
                      <div className="ledger-left">
                        <div className="ledger-icon-wrap icon-rent">
                          <Clock size={15} />
                        </div>
                        <div>
                          <div className="ledger-desc">Month-End Apartment Rent</div>
                          <div className="ledger-sub">Recurring Liability · Due May 31</div>
                        </div>
                      </div>
                      <div className="ledger-right">
                        <div className="ledger-amt tabular-nums">-₹15,000</div>
                        <span className="ledger-auto-badge">Auto-Deduct</span>
                      </div>
                    </div>

                    <div className="landing-ledger-row">
                      <div className="ledger-left">
                        <div className="ledger-icon-wrap icon-sip">
                          <TrendingUp size={15} />
                        </div>
                        <div>
                          <div className="ledger-desc">Nifty Index Fund SIP</div>
                          <div className="ledger-sub">Investment · Wealth Building</div>
                        </div>
                      </div>
                      <div className="ledger-right">
                        <div className="ledger-amt tabular-nums">-₹10,000</div>
                        <span className="ledger-type-badge">Investment</span>
                      </div>
                    </div>

                    <div className="landing-ledger-row">
                      <div className="ledger-left">
                        <div className="ledger-icon-wrap icon-salary">
                          <PieChart size={15} />
                        </div>
                        <div>
                          <div className="ledger-desc">Monthly Professional Income</div>
                          <div className="ledger-sub">Operating Inflow · Fixed Salary</div>
                        </div>
                      </div>
                      <div className="ledger-right">
                        <div className="ledger-amt-pos tabular-nums">+₹85,000</div>
                        <span className="ledger-inflow-badge">Inflow</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SPECIALIZED ARCHITECTURE: MOBILE + WEB */}
        <section className="landing-dual-arch-section">
          <div className="landing-container">
            <div className="landing-section-intro">
              <span className="landing-section-eyebrow">Dual Client Architecture</span>
              <h2 className="landing-section-heading">
                One Platform, Two Specialized Experiences
              </h2>
              <p className="landing-section-subtitle">
                Engineered to meet you wherever financial decisions happen.
              </p>
            </div>

            <div className="landing-dual-arch-grid">
              {/* Card 1: Mobile */}
              <div className="landing-arch-card">
                <div className="landing-arch-head">
                  <div className="landing-arch-icon-wrap">
                    <Smartphone size={22} />
                  </div>
                  <div>
                    <h3 className="landing-arch-title">Mobile App</h3>
                    <span className="landing-arch-tagline">"Manage your money"</span>
                  </div>
                </div>
                <ul className="landing-arch-list">
                  <li>Frictionless on-the-go expense, income, and transfer entry</li>
                  <li>Recurring liability tracking with auto-deduct notifications</li>
                  <li>Instant FMI health snapshots and daily behavioral nudges</li>
                  <li>Pocket financial assistant for active real-world spending decisions</li>
                </ul>
              </div>

              {/* Card 2: Web */}
              <div className="landing-arch-card">
                <div className="landing-arch-head">
                  <div className="landing-arch-icon-wrap">
                    <Globe size={22} />
                  </div>
                  <div>
                    <h3 className="landing-arch-title">Web Portal</h3>
                    <span className="landing-arch-tagline">"Understand your money"</span>
                  </div>
                </div>
                <ul className="landing-arch-list">
                  <li>Comprehensive time-series spending and income analytics</li>
                  <li>Transparent FMI factor decomposition and diagnostic explanation</li>
                  <li>Asset valuation, portfolio allocation, and net worth ledger</li>
                  <li>FIRE scenario testing, step-up models, and exportable reports</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & DATA ISOLATION */}
        <section className="landing-security-section">
          <div className="landing-container-narrow">
            <div className="landing-security-content">
              <div className="landing-security-icon-row">
                <ShieldCheck size={20} />
                <span className="landing-security-heading">Account Isolation & Query Boundaries</span>
              </div>
              <p className="landing-security-desc">
                Every transaction, liability schedule, and financial projection is strictly scoped to your authenticated account ID at the backend query layer. FINAURA maintains strict user isolation across all endpoints, ensuring your financial footprint is never commingled.
              </p>
            </div>
          </div>
        </section>

        {/* FINAL CONVERSION CTA */}
        <section className="landing-conversion-section">
          <div className="landing-container-narrow">
            <div className="landing-conversion-card">
              <div className="landing-conversion-ambient-glow" />
              <h2 className="landing-conversion-title">
                Take control of your financial trajectory.
              </h2>
              <p className="landing-conversion-subtitle">
                Join FINAURA today to bridge the gap between daily cash flow and long-term financial autonomy.
              </p>
              <div className="landing-conversion-actions">
                <Link to="/register">
                  <Button size="lg" variant="primary" rightIcon={<ArrowRight size={16} />}>
                    Create your account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-brand">
            © {new Date().getFullYear()} FINAURA. Unified Financial Intelligence Platform.
          </div>
          <div className="landing-footer-links">
            <Link to="/login" className="landing-footer-link">Sign In</Link>
            <Link to="/register" className="landing-footer-link">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
