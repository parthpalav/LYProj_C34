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
  CalendarRange,
  Lock,
  CheckCircle2
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
      <div className="report-header-banner no-print">
        <div className="report-header-info">
          <div className="report-type-badge">
            <Download size={12} className="inline mr-1" />
            Data Portability &amp; Ledger Exports
          </div>
          <h2 className="report-title">Financial Records &amp; Reports Export</h2>
          <p className="report-period-text">
            Export authoritative financial ledgers, liability records, and period reports in secure, RFC-compliant CSV formats
          </p>
        </div>
      </div>

      {error && (
        <div className="report-error-card mb-6">
          <AlertCircle size={20} className="text-rose-500 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Security & Sanitization Notice Card */}
      <div className="report-security-badge-card mb-6">
        <div className="report-security-icon-wrap">
          <ShieldCheck size={26} className="text-cyan-700" />
        </div>
        <div className="report-security-info">
          <div className="flex items-center gap-2 mb-1">
            <h4>Spreadsheet Formula-Injection Protected</h4>
            <span className="report-security-pill flex items-center gap-1">
              <Lock size={11} /> RFC 4180 + UTF-8 BOM
            </span>
          </div>
          <p>
            All text fields (descriptions, sources, categories) are automatically sanitized against malicious
            formula execution (<code className="code-tag">=</code>, <code className="code-tag">+</code>,{' '}
            <code className="code-tag">-</code>, <code className="code-tag">@</code>, tab, carriage return). Numeric values are strictly preserved as raw unformatted numbers for direct calculations in Microsoft Excel, Google Sheets, or LibreOffice Calc.
          </p>
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="report-export-cards-grid mb-8">
        {/* Card 1: Transactions CSV */}
        <div className="report-export-card">
          <div className="report-export-card-header">
            <div className="report-export-icon-box bg-cyan-500/10 text-cyan-600">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <span className="report-eyebrow-label">OUTFLOW LEDGER</span>
              <h3>Transactions Register</h3>
              <p className="report-export-sub">Detailed ledger of all expenses, classifications, and anomalies</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CreditCard size={13} />
              <span className="tabular-nums">{counts.transactions} Records available</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Date, Description, Category, Type, Amount, Classification Source, Is Anomaly
            </p>
          </div>

          <button
            type="button"
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
            <div className="report-export-icon-box bg-emerald-500/10 text-emerald-600">
              <Wallet size={22} />
            </div>
            <div>
              <span className="report-eyebrow-label">INFLOW LEDGER</span>
              <h3>Income Inflows</h3>
              <p className="report-export-sub">Chronological history of salaries, freelance, returns, and credits</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <Wallet size={13} />
              <span className="tabular-nums">{counts.income} Records available</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Date, Source, Amount, Description
            </p>
          </div>

          <button
            type="button"
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
            <div className="report-export-icon-box bg-amber-500/10 text-amber-600">
              <FileText size={22} />
            </div>
            <div>
              <span className="report-eyebrow-label">DEBT DIRECTORY</span>
              <h3>Liabilities &amp; Debts</h3>
              <p className="report-export-sub">Outstanding principal, interest rates, frequencies, and loan tenors</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CreditCard size={13} />
              <span className="tabular-nums">{counts.liabilities} Debts tracked</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Name, Category, Type, Amount, Outstanding Balance, Interest Rate (%), Frequency, Next Due Date, Status
            </p>
          </div>

          <button
            type="button"
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
            <div className="report-export-icon-box bg-indigo-500/10 text-indigo-600">
              <CalendarRange size={22} />
            </div>
            <div>
              <span className="report-eyebrow-label">LONGITUDINAL SUMMARY</span>
              <h3>Monthly Summaries</h3>
              <p className="report-export-sub">High-level cash flow, savings rate, 50/30/20 spend &amp; FMI by month</p>
            </div>
          </div>

          <div className="report-export-meta">
            <div className="report-export-tag">
              <CalendarRange size={13} />
              <span className="tabular-nums">{monthlyRows.length} Monthly cycles</span>
            </div>
            <p className="report-export-fields">
              <strong>Columns:</strong> Period, Total Income, Total Expenses, Net Cash Flow, Savings Rate (%), Needs Spend, Wants Spend, Investments Spend, Average FMI, Transaction Count
            </p>
          </div>

          <button
            type="button"
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
            <Printer size={20} className="text-cyan-600" />
            <h3>Print or Save Reports as PDF</h3>
          </div>
          <span className="report-card-badge">Native Browser Print</span>
        </div>

        <div className="report-print-panel">
          <div className="report-print-explanation">
            <p>
              FINAURA supports high-fidelity browser printing. Click the button below (or on any Weekly or
              Monthly report tab) to open your browser print dialog. Select <strong>Save as PDF</strong> to generate
              an executive report formatted for A4 or Letter paper.
            </p>
            <ul className="report-print-features-list">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Navigation sidebars and buttons are automatically hidden in print view.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Tables and summary charts format cleanly with page-break avoidance.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Executive financial data is preserved exactly as recorded.</span>
              </li>
            </ul>
          </div>

          <div className="report-print-trigger-wrap">
            <button type="button" className="report-print-large-btn" onClick={onPrint}>
              <Printer size={18} />
              <span>Launch Browser Print Dialog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
