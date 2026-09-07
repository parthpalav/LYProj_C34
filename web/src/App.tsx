import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './layouts/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { OverviewPage } from './pages/OverviewPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingScreen } from './components/ui/LoadingScreen';

/**
 * Route wrapper requiring valid authenticated session.
 * Displays clean branded loading screen while bootstrapping auth.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verifying session credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Route wrapper for public auth pages (login, register).
 * Redirects authenticated users directly into the application shell.
 */
const PublicAuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading FINAURA..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicAuthRoute>
                <LoginPage />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicAuthRoute>
                <RegisterPage />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicAuthRoute>
                <ForgotPasswordPage />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicAuthRoute>
                <ResetPasswordPage />
              </PublicAuthRoute>
            }
          />

          {/* Protected Application Routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Overview / Dashboard */}
            <Route index element={<OverviewPage />} />

            {/* Money / Activity Placeholder */}
            <Route
              path="activity"
              element={
                <PlaceholderPage
                  category="Money"
                  title="Activity"
                  description="Searchable, filterable ledger for transactions, income entries, and recurring liability obligations."
                  plannedFeatures={[
                    {
                      name: 'Transactions Ledger',
                      description: 'Filterable, paginated expense ledger with category correction, ML confidence review, and amount reconciliation.',
                    },
                    {
                      name: 'Income History',
                      description: 'Multi-source income records with flow smoothing, timeline analysis, and volatility metrics.',
                    },
                    {
                      name: 'Recurring Liabilities Calendar',
                      description: 'Upcoming debt and bill obligations calendar with auto-deduct state and payment history.',
                    },
                  ]}
                />
              }
            />

            {/* Understand / Insights Placeholder */}
            <Route
              path="insights"
              element={
                <PlaceholderPage
                  category="Understand"
                  title="Insights"
                  description="Deep behavioral and financial analytics, spending breakdowns, and FMI explainability."
                  plannedFeatures={[
                    {
                      name: 'Spending Breakdown & Trends',
                      description: 'Multi-month category distribution and month-over-month spending trend graphs.',
                    },
                    {
                      name: 'FMI Factor Explainability',
                      description: 'Decomposition of FMI into D1 Saving Discipline (40%), D2 Spending Control (30%), and D3 Behavioral Risk (30%).',
                    },
                    {
                      name: 'Behavioral Pattern Analysis',
                      description: 'Automated detection of late-night spending, impulse spikes, and high discretionary want-to-need ratios.',
                    },
                    {
                      name: 'Income Predictability Analytics',
                      description: 'Coefficient of variation, zero-income month resilience, and downside rolling quarter coverage.',
                    },
                  ]}
                />
              }
            />

            {/* Future / Plan Placeholder */}
            <Route
              path="plan"
              element={
                <PlaceholderPage
                  category="Future"
                  title="Plan"
                  description="Long-term financial planning, net worth tracking, scenario modeling, and Monte Carlo FIRE simulations."
                  plannedFeatures={[
                    {
                      name: 'Net Worth Trajectory',
                      description: 'Complete assets valuation minus outstanding liability principal over time.',
                    },
                    {
                      name: 'Assets Portfolio',
                      description: 'Asset classes (FIRE Investable, Semi-Liquid, Non-Investable) and individual annual return rates.',
                    },
                    {
                      name: 'Liabilities & Debt Amortization',
                      description: 'Active liabilities, remaining term months, and debt-to-income impact.',
                    },
                    {
                      name: 'Financial Goals Tracker',
                      description: 'Milestone target dates, monthly contribution requirements, and accumulated savings.',
                    },
                    {
                      name: 'FIRE Projections & Reverse Solvers',
                      description: 'Target FIRE number calculation, required nominal-flat and step-up monthly contributions.',
                    },
                    {
                      name: 'Deterministic & Monte Carlo Scenarios',
                      description: 'Base, Conservative, and Optimistic models combined with probabilistic accumulation simulations.',
                    },
                  ]}
                />
              }
            />

            {/* Documents / Reports Placeholder */}
            <Route
              path="reports"
              element={
                <PlaceholderPage
                  category="Documents"
                  title="Reports"
                  description="Historical summaries, monthly and weekly financial reports, and data exports."
                  plannedFeatures={[
                    {
                      name: 'Weekly Reports',
                      description: 'Trailing 7-day spending pacing, top category distribution, and weekly habit nudges.',
                    },
                    {
                      name: 'Monthly Summaries',
                      description: 'Calendar-month comprehensive financial statements with savings rate analysis.',
                    },
                    {
                      name: 'Yearly Heatmaps',
                      description: '365-day spending concentration visualization and seasonality identification.',
                    },
                    {
                      name: 'Data Exports (CSV)',
                      description: 'Export transaction and income histories for tax, budgeting, or offline spreadsheet analysis.',
                    },
                  ]}
                />
              }
            />

            {/* Profile Placeholder */}
            <Route
              path="profile"
              element={
                <PlaceholderPage
                  title="Profile & Financial Assumptions"
                  description="Manage personal demographics and financial modeling parameters."
                  plannedFeatures={[
                    {
                      name: 'Personal Information',
                      description: 'Full name, email address, avatar, date of birth, and derived age.',
                    },
                    {
                      name: 'Income & Retirement Targets',
                      description: 'Monthly baseline income, target retirement age, and user retirement corpus goal.',
                    },
                    {
                      name: 'Financial Modeling Assumptions',
                      description: 'Expected return rate, inflation rate, safe withdrawal rate, lifestyle ratio, and emergency fund months.',
                    },
                  ]}
                />
              }
            />

            {/* Settings Placeholder */}
            <Route
              path="settings"
              element={
                <PlaceholderPage
                  title="Settings"
                  description="Web portal preferences, session management, and system configuration."
                  plannedFeatures={[
                    {
                      name: 'Session & Authentication',
                      description: 'Current browser session state (sessionStorage interim policy), token validity, and logout.',
                    },
                    {
                      name: 'Security & Verification',
                      description: 'Email verification status and password management.',
                    },
                    {
                      name: 'Platform Infrastructure',
                      description: 'REST API backend connectivity and Python ML classification service status.',
                    },
                  ]}
                />
              }
            />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
