import React from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  AlertCircle,
  FileText,
  CreditCard,
  Wallet,
  CalendarRange
} from 'lucide-react';
import type { MonthlyCsvRow } from '../../utils/csvExport';
import type { ExportKind } from '../../hooks/useReportExport';

interface ExportReportViewProps {
  counts: {
    transactions: number;
    income: number;
    liabilities: number;
  };
  monthlyRows: MonthlyCsvRow[];
  isExporting: boolean;
  activeKind: ExportKind;
  error: string | null;
  onExportTransactions: () => void;
  onExportIncome: () => void;
  onExportLiabilities: () => void;
  onExportMonthlySummaries: (rows: MonthlyCsvRow[]) => void;
  onPrint: () => void;
}

export const ExportReportView: React.FC<ExportReportViewProps> = ({
  counts,
  monthlyRows,
  isExporting,
  activeKind,
  error,
  onExportTransactions,
  onExportIncome,
  onExportLiabilities,
  onExportMonthlySummaries,
  onPrint
}) => {
  return (
    <div className="report-view-container">
      {/* Header */}
      <div className="report-header-banner">
        <div className="report-header-info">
          <div className="report-type-badge">Data Portability & Portfolios</div>
          <h2 className="report-title">Financial Records & Reports Export</h2>
          <p className="report-period-text">
            Export raw financial ledgers and period reports in secure, machine-readable formats
          </p>
        </div>
      </div>

      {error && (
        <div className="report-error-card mb-6">
          <AlertCircle size={20} className="text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {/* Security & Sanitization Notice Card */}
      <div className="report-security-badge-card mb-6">
        <div className="report-security-icon-wrap">
          <ShieldCheck size={28} className="text-cyan-400" />
        </div>
        <div className="report-security-info">
          <h4>Spreadsheet Formula-Injection Protected</h4>
          <p>
            All text fields (descriptions, sources, categories) are automatically sanitized against malicious
            formula injection (<code className="text-cyan-300">=</code>, <code className="text-cyan-300">+</code>,{' '}
            <code className="text-cyan-300">-</code>, <code className="text-cyan-300">@</code>). Numbers are preserved as raw numeric values for direct calculations in Microsoft Excel, Google Sheets, or LibreOffice.
          </p>
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="report-export-cards-grid mb-8">
        {/* Card 1: Transactions CSV */}
        <div className="report-export-card">
          <div className="report-export-card-header">
            <div className="report-export-icon-box bg-cyan-500/10 text-cyan-400">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3>Transactions Register</h3>
              <p className="report-export-sub">Detailed ledger of all expenses and purchases</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CreditCard size={13} />
              <span>{counts.transactions} Records available</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Date, Description, Category, Type, Amount, Classification Source, Is Anomaly
            </p>
          </div>

          <button
            className="report-export-action-btn"
            disabled={isExporting || counts.transactions === 0}
            onClick={onExportTransactions}
          >
            <Download size={16} />
            <span>
              {isExporting && activeKind === 'transactions' ? 'Preparing CSV...' : 'Download Transactions CSV'}
            </span>
          </button>
        </div>

        {/* Card 2: Income Records CSV */}
        <div className="report-export-card">
          <div className="report-export-card-header">
            <div className="report-export-icon-box bg-emerald-500/10 text-emerald-400">
              <Wallet size={24} />
            </div>
            <div>
              <h3>Income Inflows</h3>
              <p className="report-export-sub">Chronological history of salaries, freelance & returns</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <Wallet size={13} />
              <span>{counts.income} Records available</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Date, Source, Amount, Description
            </p>
          </div>

          <button
            className="report-export-action-btn"
            disabled={isExporting || counts.income === 0}
            onClick={onExportIncome}
          >
            <Download size={16} />
            <span>
              {isExporting && activeKind === 'income' ? 'Preparing CSV...' : 'Download Income CSV'}
            </span>
          </button>
        </div>

        {/* Card 3: Liabilities CSV */}
        <div className="report-export-card">
          <div className="report-export-card-header">
            <div className="report-export-icon-box bg-amber-500/10 text-amber-400">
              <FileText size={24} />
            </div>
            <div>
              <h3>Liabilities & Debts</h3>
              <p className="report-export-sub">Outstanding principal, interest rates, and loan tenors</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CreditCard size={13} />
              <span>{counts.liabilities} Debts tracked</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Name, Category, Total Amount, Remaining Principal, Interest Rate, Monthly Payment, Due Date, Status
            </p>
          </div>

          <button
            className="report-export-action-btn"
            disabled={isExporting || counts.liabilities === 0}
            onClick={onExportLiabilities}
          >
            <Download size={16} />
            <span>
              {isExporting && activeKind === 'liabilities' ? 'Preparing CSV...' : 'Download Liabilities CSV'}
            </span>
          </button>
        </div>

        {/* Card 4: Monthly Summaries CSV */}
        <div className="report-export-card">
          <div className="report-export-card-header">
            <div className="report-export-icon-box bg-indigo-500/10 text-indigo-400">
              <CalendarRange size={24} />
            </div>
            <div>
              <h3>Monthly Summaries</h3>
              <p className="report-export-sub">High-level cash flow, savings rate & FMI by month</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CalendarRange size={13} />
              <span>{monthlyRows.length} Monthly cycles</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Period, Income, Expenses, Net Flow, Savings Rate, Needs, Wants, Investments, FMI Avg, Transaction Count
            </p>
          </div>

          <button
            className="report-export-action-btn"
            disabled={isExporting || monthlyRows.length === 0}
            onClick={() => onExportMonthlySummaries(monthlyRows)}
          >
            <Download size={16} />
            <span>
              {isExporting && activeKind === 'monthly' ? 'Preparing CSV...' : 'Download Summaries CSV'}
            </span>
          </button>
        </div>
      </div>

      {/* Print & PDF Document Section */}
      <div className="report-card">
        <div className="report-card-header">
          <div className="flex items-center gap-2">
            <Printer size={20} className="text-cyan-400" />
            <h3>Print or Save Reports as PDF</h3>
          </div>
          <span className="report-card-badge">Native Browser Print</span>
        </div>

        <div className="report-print-panel">
          <div className="report-print-explanation">
            <p>
              FINAURA supports high-fidelity browser printing. Click the button below (or on any Weekly or
              Monthly report tab) to open your browser print dialog. Select <strong>Save as PDF</strong> to generate
              an executive PDF report without watermark or advertising.
            </p>
            <ul className="report-print-features-list">
              <li>Navigation sidebars and buttons are automatically hidden in print view.</li>
              <li>Tables and summary charts format cleanly to fit standard A4 / Letter pages.</li>
              <li>Executive financial data is preserved exactly as recorded.</li>
            </ul>
          </div>

          <div className="report-print-trigger-wrap">
            <button className="report-print-large-btn" onClick={onPrint}>
              <Printer size={18} />
              <span>Launch Browser Print Dialog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
