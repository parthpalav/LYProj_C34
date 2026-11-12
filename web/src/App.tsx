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
import { NotFoundPage } from './pages/NotFoundPage';
import { CelebrationHost } from './components/ui/CelebrationHost';
import { LoadingScreen } from './components/ui/LoadingScreen';

// Lazy load major workspace pages for optimal bundle chunking (Part 7)
const OverviewPage = React.lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ActivityPage = React.lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const PlanPage = React.lazy(() => import('./pages/PlanPage').then((m) => ({ default: m.PlanPage })));
const NetWorthPage = React.lazy(() => import('./pages/NetWorthPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const FamilyPage = React.lazy(() => import('./pages/FamilyPage').then((m) => ({ default: m.FamilyPage })));
const AssistantPage = React.lazy(() => import('./pages/AssistantPage'));
const RoundupsPage = React.lazy(() => import('./pages/RoundupsPage'));
const ReviewPage = React.lazy(() => import('./pages/ReviewPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));

// Same rule as the mobile navigator: either flag marks setup as done.
const isOnboarded = (u: { onboardingComplete?: boolean; onboardingCompleted?: boolean } | null) =>
  Boolean(u?.onboardingComplete || u?.onboardingCompleted);

/**
 * Route wrapper requiring valid authenticated session.
 * Displays clean branded loading screen while bootstrapping auth.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; onboarding?: boolean }> = ({ children, onboarding = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verifying session credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // New accounts finish setup first; finished accounts never see setup again.
  if (!onboarding && !isOnboarded(user)) {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboarding && isOnboarded(user)) {
    return <Navigate to="/app" replace />;
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

          {/* First-run setup (mobile Onboarding parity) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute onboarding>
                <OnboardingPage />
              </ProtectedRoute>
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
            <Route path="net-worth" element={<NetWorthPage />} />

            {/* Documents / Reports Workspace */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Family & Household Workspace */}
            <Route path="family" element={<FamilyPage />} />

            {/* Mobile parity: AI assistant, round-up vault, classifier review queue */}
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="roundups" element={<RoundupsPage />} />
            <Route path="review" element={<ReviewPage />} />

            {/* Profile & Financial Assumptions */}
            <Route path="profile" element={<ProfilePage />} />

            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Canonical Convenience Redirect */}
          <Route path="/family" element={<Navigate to="/app/family" replace />} />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <CelebrationHost />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
