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
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingScreen } from './components/ui/LoadingScreen';

// Lazy load major workspace pages for optimal bundle chunking (Part 7)
const OverviewPage = React.lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ActivityPage = React.lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const PlanPage = React.lazy(() => import('./pages/PlanPage').then((m) => ({ default: m.PlanPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

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

  return (
    <React.Suspense fallback={<LoadingScreen message="Loading workspace..." />}>
      {children}
    </React.Suspense>
  );
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

            {/* Money / Activity Workspace */}
            <Route path="activity" element={<ActivityPage />} />

            {/* Understand / Insights Workspace */}
            <Route path="insights" element={<InsightsPage />} />

            {/* Future / Plan Workspace */}
            <Route path="plan" element={<PlanPage />} />

            {/* Documents / Reports Workspace */}
            <Route path="reports" element={<ReportsPage />} />

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
