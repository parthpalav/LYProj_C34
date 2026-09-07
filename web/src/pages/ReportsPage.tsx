import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReportTabs, type ReportTabId } from '../components/reports/ReportTabs';
import { WeeklyReportView } from '../components/reports/WeeklyReportView';
import { MonthlyReportView } from '../components/reports/MonthlyReportView';
import { HistoryReportView } from '../components/reports/HistoryReportView';
import { ExportReportView } from '../components/reports/ExportReportView';

import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { useMonthlyReport } from '../hooks/useMonthlyReport';
import { useReportHistory } from '../hooks/useReportHistory';
import { useReportExport } from '../hooks/useReportExport';
import type { MonthlyCsvRow } from '../utils/csvExport';

export const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as ReportTabId | null;
  const activeTab: ReportTabId =
    rawTab === 'monthly' || rawTab === 'history' || rawTab === 'export'
      ? rawTab
      : 'weekly';

  // Domain hooks
  const weekly = useWeeklyReport();
  const monthly = useMonthlyReport();
  const history = useReportHistory();
  const exportHook = useReportExport();

  const handleSelectTab = (tab: ReportTabId) => {
    setSearchParams({ tab });
  };

  const handleInspectMonth = (year: number, month: number) => {
    monthly.selectPeriod(year, month);
    setSearchParams({ tab: 'monthly' });
  };

  // Convert history summaries into MonthlyCsvRow for export
  const monthlyCsvRows: MonthlyCsvRow[] = useMemo(() => {
    return history.summaries.map((s) => ({
      period: s.period,
      totalIncome: s.totalIncome,
      totalExpenses: s.totalExpenses,
      netCashFlow: s.netCashFlow,
      savingsRate: s.savingsRate,
      needsSpend: s.needsSpend,
      wantsSpend: s.wantsSpend,
      investmentsSpend: s.investmentsSpend,
      fmiAverage: s.fmiAverage !== null ? s.fmiAverage : 'N/A',
      transactionCount: s.transactionCount
    }));
  }, [history.summaries]);

  return (
    <div className="reports-page-wrapper">
      {/* Page Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">
            Historical accounting summaries, period pacing, and secure portfolio exports
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <ReportTabs activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Tab Contents */}
      <div className="report-tab-content">
        {activeTab === 'weekly' && (
          <WeeklyReportView
            report={weekly.weeklyReport}
            pacing={weekly.pacingReport}
            loading={weekly.loading}
            error={weekly.error}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReportView
            report={monthly.report}
            loading={monthly.loading}
            error={monthly.error}
            selectedYear={monthly.selectedYear}
            selectedMonth={monthly.selectedMonth}
            availableMonths={monthly.availableMonths}
            onSelectPeriod={monthly.selectPeriod}
          />
        )}

        {activeTab === 'history' && (
          <HistoryReportView
            summaries={history.summaries}
            range={history.range}
            loading={history.loading}
            error={history.error}
            onSelectRange={history.setRange}
            onInspectMonth={handleInspectMonth}
          />
        )}

        {activeTab === 'export' && (
          <ExportReportView
            counts={exportHook.counts}
            monthlyRows={monthlyCsvRows}
            isExporting={exportHook.isExporting}
            activeKind={exportHook.activeKind}
            error={exportHook.error}
            onExportTransactions={exportHook.exportTransactions}
            onExportIncome={exportHook.exportIncome}
            onExportLiabilities={exportHook.exportLiabilities}
            onExportMonthlySummaries={exportHook.exportMonthlySummaries}
            onPrint={exportHook.printReport}
          />
        )}
      </div>
    </div>
  );
};
