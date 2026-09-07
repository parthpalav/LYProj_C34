import React from 'react';
import {
  Wallet,
  Activity,
  TrendingUp,
  Percent,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOverview } from '../hooks/useOverview';
import { getUserFirstName, formatCurrencyINR } from '../utils/formatters';
import { MetricCard } from '../components/dashboard/MetricCard';
import { SectionCard } from '../components/dashboard/SectionCard';
import { SectionError } from '../components/dashboard/SectionError';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { Button } from '../components/ui/Button';
import { CashFlowChart } from '../components/dashboard/CashFlowChart';
import { SpendingDonutChart } from '../components/dashboard/SpendingDonutChart';
import { FmiPillarsView } from '../components/dashboard/FmiPillarsView';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { UpcomingLiabilities } from '../components/dashboard/UpcomingLiabilities';
import { RecentActivityTable } from '../components/dashboard/RecentActivityTable';
import { FutureOutlookPanel } from '../components/dashboard/FutureOutlookPanel';

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const firstName = getUserFirstName(user);

  const {
    data,
    isLoading,
    isRefreshing,
    sectionErrors,
    lastUpdated,
    refetch,
  } = useOverview();

  const {
    dashboard,
    fmi,
    fmiScoreChange,
    alerts,
    liabilities,
    transactions,
    predictability,
    cashFlowHistory,
    currentMonthIncome,
    currentMonthSpending,
    currentMonthNetFlow,
    savingsRate,
  } = data;

  // Authoritative current balance from backend
  const currentBalance = dashboard?.balance ?? 0;

  // FMI Composite Score & verified Label
  const fmiScore = fmi?.FMI ?? dashboard?.fmiScore ?? null;
  const fmiLabel = fmi?.fmiLabel; // Only use if returned by backend

  return (
    <div className="overview-page">
      {/* Page Header */}
      <header className="overview-header">
        <div className="overview-header-left">
          <span className="overview-context-badge">FINAURA Dashboard</span>
          <h1 className="overview-title">Overview</h1>
          <p className="overview-subtitle">
            Welcome back, {firstName} · Here is your financial snapshot as of today.
          </p>
        </div>

        <div className="overview-header-right">
          {lastUpdated && (
            <span className="overview-last-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isRefreshing || isLoading}
            leftIcon={<RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* Top 4 Summary Metric Cards */}
      <section className="overview-metrics-grid" aria-label="Financial Summary Cards">
        {isLoading ? (
          <>
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
          </>
        ) : (
          <>
            {/* Card 1: Balance */}
            <MetricCard
              label="Current Balance"
              value={formatCurrencyINR(currentBalance)}
              subtext="Liquid operating balance"
              icon={Wallet}
            />

            {/* Card 2: FMI */}
            <MetricCard
              label="FMI Score"
              value={fmiScore !== null ? `${fmiScore} / 100` : '—'}
              badge={fmiLabel}
              trend={
                fmiScoreChange !== null
                  ? {
                      text: `${fmiScoreChange >= 0 ? '↑ +' : '↓ '}${fmiScoreChange} from previous snapshot`,
                      positive: fmiScoreChange >= 0,
                    }
                  : undefined
              }
              subtext={fmiScoreChange === null ? 'Financial Momentum Index' : undefined}
              icon={Activity}
            />

            {/* Card 3: Monthly Net Flow */}
            <MetricCard
              label="Monthly Net Flow"
              value={formatCurrencyINR(currentMonthNetFlow, { showSign: true })}
              trend={{
                text: currentMonthNetFlow >= 0 ? 'Surplus' : 'Deficit',
                positive: currentMonthNetFlow >= 0,
              }}
              subtext={`Inflow: ${formatCurrencyINR(currentMonthIncome)} · Outflow: ${formatCurrencyINR(currentMonthSpending)}`}
              icon={TrendingUp}
            />

            {/* Card 4: Savings Rate */}
            <MetricCard
              label="Savings Rate"
              value={savingsRate !== null ? `${savingsRate}%` : 'Not enough data yet'}
              subtext={
                savingsRate !== null
                  ? 'of current month income retained'
                  : 'Record income to calculate rate'
              }
              icon={Percent}
            />
          </>
        )}
      </section>

      {/* Primary Charts Row: Cash Flow & Spending Breakdown */}
      <section className="overview-charts-grid">
        <SectionCard
          title="Cash Flow Trend"
          subtitle="Monthly inflow vs outflow across the trailing 6 calendar months"
        >
          {isLoading ? (
            <SkeletonCard height={280} />
          ) : sectionErrors.transactions && sectionErrors.income ? (
            <SectionError message="Cash flow history is temporarily unavailable." onRetry={refetch} />
          ) : (
            <CashFlowChart data={cashFlowHistory} />
          )}
        </SectionCard>

        <SectionCard
          title="Current Month Spending"
          subtitle="Classification by Needs, Wants, and Investments"
        >
          {isLoading ? (
            <SkeletonCard height={280} />
          ) : sectionErrors.dashboard ? (
            <SectionError message="Spending breakdown is temporarily unavailable." onRetry={refetch} />
          ) : (
            <SpendingDonutChart breakdown={dashboard?.wantsNeedsBreakdown} />
          )}
        </SectionCard>
      </section>

      {/* Health & Alerts Row */}
      <section className="overview-two-col-grid">
        <SectionCard
          title="Financial Health (FMI)"
          subtitle="Deterministic evaluation across 3 core discipline pillars"
        >
          {isLoading ? (
            <SkeletonCard height={240} />
          ) : sectionErrors.fmi ? (
            <SectionError message="FMI pillar scoring is temporarily unavailable." onRetry={refetch} />
          ) : (
            <FmiPillarsView fmi={fmi} />
          )}
        </SectionCard>

        <SectionCard
          title="What Needs Your Attention?"
          subtitle="Active notifications, budget pacing, and behavioral nudges"
        >
          {isLoading ? (
            <SkeletonCard height={240} />
          ) : sectionErrors.alerts ? (
            <SectionError message="Financial alerts are temporarily unavailable." onRetry={refetch} />
          ) : (
            <AlertsPanel alerts={alerts} />
          )}
        </SectionCard>
      </section>

      {/* Obligations & Activity Row */}
      <section className="overview-two-col-grid">
        <SectionCard
          title="Upcoming Obligations"
          subtitle="Scheduled recurring liabilities and bill due dates"
        >
          {isLoading ? (
            <SkeletonCard height={240} />
          ) : sectionErrors.liabilities ? (
            <SectionError message="Liabilities schedule is temporarily unavailable." onRetry={refetch} />
          ) : (
            <UpcomingLiabilities liabilities={liabilities} />
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          subtitle="Latest transactions and spending debits"
        >
          {isLoading ? (
            <SkeletonCard height={240} />
          ) : sectionErrors.transactions ? (
            <SectionError message="Recent activity ledger is temporarily unavailable." onRetry={refetch} />
          ) : (
            <RecentActivityTable transactions={transactions} />
          )}
        </SectionCard>
      </section>

      {/* Bottom Full-Width: Future Outlook */}
      <section className="overview-full-width">
        <SectionCard
          title="Future Outlook & Planning"
          subtitle="Deterministic targets for long-term independence and emergency reserves"
        >
          {isLoading ? (
            <SkeletonCard height={160} />
          ) : (
            <FutureOutlookPanel
              snapshot={predictability}
              error={sectionErrors.predictability}
            />
          )}
        </SectionCard>
      </section>
    </div>
  );
};
