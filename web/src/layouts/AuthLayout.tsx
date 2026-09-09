import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, ShieldCheck, Sparkles } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="auth-page-root">
      <div className="auth-split-wrapper">
        {/* LEFT: Brand / Visual Panel (Desktop) */}
        <aside className="auth-brand-panel" aria-hidden="true">
          <div className="auth-brand-panel-glow" />

          <div className="auth-brand-content">
            <Link to="/" className="auth-brand-header">
              <div className="auth-brand-badge">F</div>
              <div className="auth-brand-text">
                <span className="auth-brand-title">FINAURA</span>
                <span className="auth-brand-tagline">Financial Intelligence</span>
              </div>
            </Link>

            <div className="auth-brand-hero-text">
              <h2 className="auth-brand-headline">
                Intelligence for your financial journey.
              </h2>
              <p className="auth-brand-desc">
                From daily cash flow discipline to lifelong independence modeling, experience transparent financial diagnostics designed to keep you in control.
              </p>
            </div>

            {/* Illustrative Product Motif */}
            <div className="auth-brand-motif-card">
              <div className="auth-motif-head">
                <div className="auth-motif-title-row">
                  <Activity size={16} className="auth-motif-icon" />
                  <span className="auth-motif-title">Financial Momentum Index</span>
                </div>
                <span className="auth-motif-watermark">Illustrative</span>
              </div>

              <div className="auth-motif-score-row">
                <span className="auth-motif-score tabular-nums">78</span>
                <span className="auth-motif-denom">/ 100</span>
                <span className="auth-motif-status">Good Momentum</span>
              </div>

              <div className="auth-motif-weights-list">
                <div className="auth-motif-weight-item">
                  <span className="weight-name">Saving Discipline</span>
                  <span className="weight-val">40% weight</span>
                </div>
                <div className="auth-motif-weight-track">
                  <div className="auth-motif-weight-fill fill-green" style={{ width: '82%' }} />
                </div>

                <div className="auth-motif-weight-item">
                  <span className="weight-name">Spending Control</span>
                  <span className="weight-val">30% weight</span>
                </div>
                <div className="auth-motif-weight-track">
                  <div className="auth-motif-weight-fill fill-blue" style={{ width: '75%' }} />
                </div>

                <div className="auth-motif-weight-item">
                  <span className="weight-name">Behavioral Risk</span>
                  <span className="weight-val">30% weight</span>
                </div>
                <div className="auth-motif-weight-track">
                  <div className="auth-motif-weight-fill fill-amber" style={{ width: '76%' }} />
                </div>
              </div>
            </div>

            {/* Factual Security Reassurance */}
            <div className="auth-brand-trust">
              <ShieldCheck size={16} className="auth-trust-icon" />
              <span>Strict account isolation enforced at query boundaries</span>
            </div>
          </div>
        </aside>

        {/* RIGHT: Form Panel */}
        <main className="auth-form-panel">
          <div className="auth-form-inner">
            <div className="auth-top-nav">
              <Link to="/" className="auth-back-link">
                <ArrowLeft size={16} />
                <span>Back to FINAURA</span>
              </Link>
            </div>

            {/* Form Header */}
            <div className="auth-form-header">
              <div className="auth-mobile-brand">
                <div className="auth-brand-badge">F</div>
                <span className="auth-brand-title">FINAURA</span>
              </div>
              <h1 className="auth-form-title">{title}</h1>
              <p className="auth-form-subtitle">{subtitle}</p>
            </div>

            {/* Child Form */}
            <div className="auth-form-body">
              {children}
            </div>

            <div className="auth-form-footer">
              <Sparkles size={13} className="auth-footer-icon" aria-hidden="true" />
              <span>Unified Web Intelligence & Planning Platform</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
