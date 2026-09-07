import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InsightsTabs, type InsightsTab } from '../components/insights/InsightsTabs';

// Spending Components
import { SpendingTrendChart } from '../components/insights/SpendingTrendChart';
import { SpendingTypeCards } from '../components/insights/SpendingTypeCards';
import { CategoryRanking } from '../components/insights/CategoryRanking';
import { MonthOverMonthComparison } from '../components/insights/MonthOverMonthComparison';
import { CategoryMovement } from '../components/insights/CategoryMovement';

// FMI Components
import { FmiScoreHero } from '../components/insights/FmiScoreHero';
import { FmiPillarsGrid } from '../components/insights/FmiPillarsGrid';
import { FmiHistoryChart } from '../components/insights/FmiHistoryChart';
import { FmiDeltaSummary } from '../components/insights/FmiDeltaSummary';
import { FmiFactorsPanel } from '../components/insights/FmiFactorsPanel';

// Behaviour Components
import { BehaviorSummaryStrip } from '../components/insights/BehaviorSummaryStrip';
import { BehaviorSignalCards } from '../components/insights/BehaviorSignalCards';
import { BehaviorHistoryNotice } from '../components/insights/BehaviorHistoryNotice';
import { AnomalousTransactionsList } from '../components/insights/AnomalousTransactionsList';

// Income Components
import { IncomeTrendChart } from '../components/insights/IncomeTrendChart';
import { IncomeMetricsGrid } from '../components/insights/IncomeMetricsGrid';
import { IncomeSourceConcentration } from '../components/insights/IncomeSourceConcentration';
import { IncomeResilienceCards } from '../components/insights/IncomeResilienceCards';

// Hooks
import { useSpendingInsights } from '../hooks/useSpendingInsights';
import { useFmiInsights } from '../hooks/useFmiInsights';
import { useBehaviorInsights } from '../hooks/useBehaviorInsights';
import { useIncomeInsights } from '../hooks/useIncomeInsights';

// UI
import { SectionError } from '../components/dashboard/SectionError';
import { Button } from '../components/ui/Button';

const TabLoadingSkeleton: React.FC<{ height?: string }> = ({ height = '260px' }) => (
  <div
    className="insights-card animate-pulse"
    style={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-surface-subtle, #f8fafc)',
    }}
  >
    <span className="text-tertiary text-sm">Loading financial analytics...</span>
  </div>
);

export const InsightsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from URL query param
  const activeTab = useMemo<InsightsTab>(() => {
    const t = searchParams.get('tab');
    if (t === 'fmi' || t === 'behaviour' || t === 'income') {
      return t;
    }
    return 'spending';
  }, [searchParams]);

  const handleTabChange = (newTab: InsightsTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    });
  };

  // Independent Domain Hooks for Partial Failure Isolation
  const spending = useSpendingInsights();
  const fmi = useFmiInsights();
  const behavior = useBehaviorInsights();
  const income = useIncomeInsights();

  const handleRefreshCurrentTab = () => {
    switch (activeTab) {
      case 'spending':
        spending.refresh();
        break;
      case 'fmi':
        fmi.refresh();
        break;
      case 'behaviour':
        behavior.refresh();
        break;
      case 'income':
        income.refresh();
        break;
    }
  };

  const isCurrentTabLoading = () => {
    switch (activeTab) {
      case 'spending':
        return spending.loading;
      case 'fmi':
        return fmi.loading;
      case 'behaviour':
        return behavior.loading;
      case 'income':
        return income.loading;
    }
  };

  return (
    <div className="activity-page-layout">
      {/* Workspace Header */}
      <div className="activity-header-block">
        <div className="activity-title-group">
          <h1 className="activity-main-heading">Financial Insights &amp; Explanations</h1>
          <p className="activity-sub-heading">
            Understand the patterns, momentum, and predictability governing your financial health
          </p>
        </div>
        <div className="activity-header-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshCurrentTab}
            isLoading={isCurrentTabLoading()}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Synchronized Tab Navigation */}
      <InsightsTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* TAB CONTENT: Spending */}
      {activeTab === 'spending' && (
        <div className="insights-tab-content animate-fade-in">
          {spending.error ? (
            <SectionError message={spending.error} onRetry={spending.refresh} />
          ) : spending.loading ? (
            <div className="insights-loading-grid">
              <TabLoadingSkeleton height="320px" />
              <div className="two-col-grid" style={{ marginTop: '20px' }}>
                <TabLoadingSkeleton height="240px" />
                <TabLoadingSkeleton height="240px" />
              </div>
            </div>
          ) : (
            <div className="insights-sections-stack">
              {/* Needs / Wants / Investments Summary */}
              <SpendingTypeCards analysis={spending.typeAnalysis} />

              {/* Monthly Spending Trend Grouped Bar Chart */}
              <SpendingTrendChart
                data={spending.trendData}
                range={spending.range}
                onRangeChange={spending.setRange}
              />

              {/* Comparable-Period MoM Comparison & Category Movement */}
              <div className="insights-two-col-grid">
                <MonthOverMonthComparison comparison={spending.momComparison} />
                <CategoryMovement
                  movements={spending.categoryMovements}
                  periodLabel={spending.momComparison.periodLabel}
                />
              </div>

              {/* Ranked Category Breakdown */}
              <CategoryRanking categories={spending.categoryRankings} />
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: FMI */}
      {activeTab === 'fmi' && (
        <div className="insights-tab-content animate-fade-in">
          {fmi.error ? (
            <SectionError message={fmi.error} onRetry={fmi.refresh} />
          ) : fmi.loading ? (
            <div className="insights-loading-grid">
              <TabLoadingSkeleton height="160px" />
              <div className="three-col-grid" style={{ marginTop: '20px' }}>
                <TabLoadingSkeleton height="180px" />
                <TabLoadingSkeleton height="180px" />
                <TabLoadingSkeleton height="180px" />
              </div>
            </div>
          ) : (
            <div className="insights-sections-stack">
              {/* Current Composite Hero */}
              <FmiScoreHero fmi={fmi.currentFmi} />

              {/* D1, D2, D3 Pillars Grid */}
              <FmiPillarsGrid fmi={fmi.currentFmi} />

              {/* FMI Historical Trajectory Chart */}
              <FmiHistoryChart
                data={fmi.chartData}
                range={fmi.historyRange}
                onRangeChange={fmi.setHistoryRange}
              />

              {/* Delta Comparison Summary & Explanations Panel */}
              <div className="insights-two-col-grid">
                <FmiDeltaSummary summary={fmi.deltaSummary} />
                <FmiFactorsPanel
                  insights={fmi.backendInsights}
                  factors={fmi.neutralFactors}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Behaviour */}
      {activeTab === 'behaviour' && (
        <div className="insights-tab-content animate-fade-in">
          {behavior.error ? (
            <SectionError message={behavior.error} onRetry={behavior.refresh} />
          ) : behavior.loading ? (
            <div className="insights-loading-grid">
              <TabLoadingSkeleton height="120px" />
              <TabLoadingSkeleton height="240px" />
            </div>
          ) : (
            <div className="insights-sections-stack">
              {/* Dynamic Signal Counters */}
              <BehaviorSummaryStrip
                signals={behavior.dynamicSignalCounters}
                anomaliesCount={behavior.anomalousTransactions.length}
                analyzedCount={behavior.analyzedCount}
              />

              {/* Historical Boundary Notice */}
              <BehaviorHistoryNotice />

              {/* Detected Behavioral Patterns */}
              <BehaviorSignalCards patterns={behavior.patterns} />

              {/* Anomalous Transactions List */}
              <AnomalousTransactionsList transactions={behavior.anomalousTransactions} />
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Income */}
      {activeTab === 'income' && (
        <div className="insights-tab-content animate-fade-in">
          {income.error ? (
            <SectionError message={income.error} onRetry={income.refresh} />
          ) : income.loading ? (
            <div className="insights-loading-grid">
              <TabLoadingSkeleton height="300px" />
              <TabLoadingSkeleton height="200px" />
            </div>
          ) : (
            <div className="insights-sections-stack">
              {/* Authoritative Income Predictability Metrics */}
              <IncomeMetricsGrid stats={income.incomeStats} />

              {/* Essential Coverage Ratio & Buffer Runway */}
              <IncomeResilienceCards resilience={income.resilience} />

              {/* Monthly Income Trend Chart with Mean Reference Line */}
              <IncomeTrendChart
                data={income.trendData}
                averageIncome={income.averageMonthlyIncome}
                range={income.range}
                onRangeChange={income.setRange}
              />

              {/* Income Source Concentration Breakdown */}
              <IncomeSourceConcentration sources={income.sourceConcentration} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
