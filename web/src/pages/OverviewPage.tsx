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
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
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

  // Smooth numeric counter animation on initial successful data load
  const animBalance = useAnimatedNumber(isLoading ? null : currentBalance);
  const animNetFlow = useAnimatedNumber(isLoading ? null : currentMonthNetFlow);
  const animFmi = useAnimatedNumber(isLoading || fmiScore === null ? null : fmiScore);
  const animSavings = useAnimatedNumber(isLoading || savingsRate === null ? null : savingsRate);

  // Dynamic time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingHeadline = user?.name ? `${getGreeting()}, ${firstName}` : `${getGreeting()}`;

  return (
    <div className="overview-page">
      {/* Page Header */}
      <header className="overview-header overview-section-hero">
        <div className="overview-header-left">
          <span className="overview-context-badge">Financial Intelligence</span>
          <h1 className="overview-title">{greetingHeadline}</h1>
          <p className="overview-subtitle">
            Here’s your financial picture today.
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

      {/* Top 4 Summary Metric Cards — Balance is the Primary Hero Anchor */}
      <section className="overview-metrics-grid overview-section-hero" aria-label="Financial Summary Cards">
        {isLoading ? (
          <>
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
          </>
        ) : (
          <>
            {/* Card 1: Dominant Balance Hero */}
            <MetricCard
              variant="hero"
              label="Current Balance"
              value={formatCurrencyINR(animBalance ?? currentBalance)}
              subtext="Liquid operating balance across active accounts"
              icon={Wallet}
            />

            {/* Card 2: FMI Score */}
            <MetricCard
              label="FMI Score"
              value={
                animFmi !== null && animFmi !== undefined
                  ? `${animFmi} / 100`
                  : fmiScore !== null
                  ? `${fmiScore} / 100`
                  : '—'
              }
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
              value={formatCurrencyINR(animNetFlow ?? currentMonthNetFlow, { showSign: true })}
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
              value={
                savingsRate !== null
                  ? `${animSavings ?? savingsRate}%`
                  : 'Not enough data yet'
              }
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
      <section className="overview-charts-grid overview-section-1">
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
      <section className="overview-two-col-grid overview-section-2">
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
      <section className="overview-two-col-grid overview-section-3">
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
      <section className="overview-full-width overview-section-4">
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
