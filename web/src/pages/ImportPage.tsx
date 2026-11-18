import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, CheckCircle2, Undo2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { COMMON_INCOME_SOURCES } from '../utils/incomeSources';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { previewStatement, commitStatement, undoImport, apiErrorCode } from '../services/api';
import type { StatementPreview, StatementRow, StatementCommitResult } from '../services/api';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../types';
import type { TransactionType } from '../types';
import { PAYMENT_KIND_LABEL, paymentMethodLabel } from '../utils/paymentMethods';
import { formatCurrencyINR } from '../utils/formatters';
import { getAppTimezone } from '../utils/timezone';
import { fileToBase64 } from '../utils/fileData';

const MAX_BYTES = 6 * 1024 * 1024;
const PARSER_LABEL: Record<StatementPreview['parser'], string> = {
  csv: 'Read from CSV',
  gemini: 'Read by Gemini AI',
  local: 'Read by the offline parser',
};

const shortDate = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-IN', { timeZone: getAppTimezone(), day: 'numeric', month: 'short', year: 'numeric' })
  : '');

/**
 * Bulk import from a bank statement (CSV or PDF). The server reads and classifies the rows,
 * the user reviews them here, and only the ticked rows are saved. Imports are history only:
 * they never change the bank balance or a card's outstanding.
 */
export const ImportPage: React.FC = () => {
  const { methods } = usePaymentMethods();
  const activeMethods = methods.filter((m) => m.status === 'active');
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [methodId, setMethodId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [setBalance, setSetBalance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<StatementCommitResult | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: 'success' | 'error' }>({ message: null, type: 'success' });

  const reset = () => {
    setFile(null); setPassword(''); setNeedsPassword(false); setError(null);
    setPreview(null); setRows([]); setSelected(new Set()); setSetBalance(false); setResult(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    reset();
    if (!/\.(csv|pdf)$/i.test(f.name)) { setError('Choose a .csv or .pdf statement.'); return; }
    if (f.size > MAX_BYTES) { setError('That file is larger than 6 MB. Export a shorter date range.'); return; }
    setFile(f);
  };

  const read = async () => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const data = await fileToBase64(file);
      const p = await previewStatement({ fileName: file.name, mimeType: file.type || '', data, password: password || undefined });
      setNeedsPassword(false);
      setPreview(p);
      setRows(p.rows);
      // Rows that look already recorded start unticked.
      setSelected(new Set(p.rows.filter((r) => !r.duplicate).map((r) => r.rowId)));
      if (p.suggestedPaymentMethodId && activeMethods.some((m) => m.id === p.suggestedPaymentMethodId)) setMethodId(p.suggestedPaymentMethodId);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT') {
        setNeedsPassword(true);
        setError(code === 'PASSWORD_INCORRECT' ? 'That password did not open the PDF.' : 'This PDF is password protected. Banks usually use your customer ID or date of birth.');
      } else {
        const message = (err as any)?.response?.data?.error;
        setError(message || ((err as any)?.code === 'ECONNABORTED' ? 'Reading took too long. Try again, or use the CSV.' : 'Could not read this statement.'));
      }
    } finally {
      setReading(false);
    }
  };

  const editRow = (rowId: string, patch: Partial<StatementRow>) => {
    setRows((list) => list.map((r) => (r.rowId === rowId ? { ...r, ...patch, userEdited: true } : r)));
  };
  const toggle = (rowId: string) => {
    setSelected((s) => { const next = new Set(s); if (next.has(rowId)) next.delete(rowId); else next.add(rowId); return next; });
  };
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.rowId)), [rows, selected]);
  const totals = useMemo(() => ({
    out: chosen.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amount, 0),
    in: chosen.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amount, 0),
  }), [chosen]);
  const isBank = methodId === '';
  const closing = preview?.summary.closingBalance ?? null;

  const save = async () => {
    if (!chosen.length) return;
    setSaving(true);
    setError(null);
    try {
      const r = await commitStatement({
        rows: chosen,
        paymentMethodId: methodId || null,
        ...(setBalance && isBank && closing !== null ? { setClosingBalance: true, closingBalance: closing } : {}),
      });
      setResult(r);
    } catch (err) {
      setError((err as any)?.response?.data?.error || 'Could not import these rows.');
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    if (!result) return;
    setUndoing(true);
    try {
      await undoImport(result.batchId);
      setToast({ message: 'Import undone.', type: 'success' });
      setResult(null);
    } catch {
      setToast({ message: "Couldn't undo the import.", type: 'error' });
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="parity-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />
      <PageHeader
        title="Import bank statement"
        category="ACTIVITY"
        description="Add months of history at once from your bank's CSV or PDF statement."
        actions={<Link className="next-step-action" to="/app/activity">Back to Activity</Link>}
      />

      {result ? (
        <section className="parity-card import-done">
          <CheckCircle2 size={36} className="import-done-icon" aria-hidden="true" />
          <h2>Statement imported</h2>
          <p className="parity-muted">
            {result.insertedTransactions} expense{result.insertedTransactions === 1 ? '' : 's'} and {result.insertedIncome} income entr{result.insertedIncome === 1 ? 'y' : 'ies'} added
            {result.skipped ? `, ${result.skipped} already imported` : ''}.
            {result.balanceSetTo !== undefined ? ` Bank balance set to ${formatCurrencyINR(result.balanceSetTo)}.` : ' Your balances were not changed.'}
          </p>
          {chosen.some((r) => r.needsReview && !r.userEdited) && (
            <p className="parity-muted">Some labels were uncertain. <Link to="/app/review">Check AI guesses</Link></p>
          )}
          <div className="parity-actions">
            <Link className="next-step-action" to="/app/activity">View in Activity</Link>
            <Button variant="outline" leftIcon={<Undo2 size={16} />} onClick={undo} isLoading={undoing}>Undo import</Button>
            <Button variant="ghost" onClick={reset}>Import another</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="parity-card">
            <h2>1. Choose the statement</h2>
            <p className="parity-muted">CSV from net banking works best. PDF statements work too, including password-protected ones.</p>
            {error && <p className="parity-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}

            <div
              className={`import-drop${dragging ? ' is-dragging' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
            >
              <FileUp size={28} aria-hidden="true" />
              <strong>{file ? file.name : 'Drop a CSV or PDF here, or click to choose'}</strong>
              <span>{file ? `${Math.ceil(file.size / 1024)} KB` : 'Up to 6 MB'}</span>
            </div>
            <input ref={fileInput} type="file" accept=".csv,.pdf,text/csv,application/pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />

            <div className="parity-grid-2" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="imp-method" className="form-label">Which account is this?</label>
                <select id="imp-method" className="form-select" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                  <option value="">Bank account (balance)</option>
                  {activeMethods.map((m) => (
                    <option key={m.id} value={m.id}>{PAYMENT_KIND_LABEL[m.kind]} · {paymentMethodLabel(m)}</option>
                  ))}
                </select>
              </div>
              {needsPassword && (
                <div className="form-group">
                  <label htmlFor="imp-password" className="form-label">PDF password</label>
                  <input id="imp-password" type="password" className="form-input" value={password} autoComplete="off" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') read(); }} />
                </div>
              )}
            </div>
            <p className="parity-hint">The file is read once and not stored. PDF text is sent to Google Gemini with account numbers masked; if Gemini is busy, an offline parser reads it instead.</p>
            <div className="parity-actions">
              <Button onClick={read} isLoading={reading} disabled={!file || (needsPassword && !password)}>
                {reading ? 'Reading statement…' : 'Read statement'}
              </Button>
            </div>
          </section>

          {preview && (
            <section className="parity-card">
              <div className="import-summary-head">
                <h2>2. Review {rows.length} transactions</h2>
                <span className={`import-parser import-parser-${preview.parser}`}>{PARSER_LABEL[preview.parser]}</span>
              </div>
              <p className="parity-muted">
                {shortDate(preview.summary.periodStart)} – {shortDate(preview.summary.periodEnd)}
                {preview.summary.last4 ? ` · account ending ${preview.summary.last4}` : ''}
                {preview.fallbackReason ? ' · Gemini was unavailable, so the offline parser was used.' : ''}
              </p>
              {preview.summary.duplicates > 0 && (
                <p className="parity-muted" style={{ marginTop: 6 }}>{preview.summary.duplicates} row{preview.summary.duplicates === 1 ? ' looks' : 's look'} already recorded and {preview.summary.duplicates === 1 ? 'is' : 'are'} unticked.</p>
              )}

              <div className="import-table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.rowId)))} /></th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category / source</th>
                      <th>Type</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowId} className={selected.has(r.rowId) ? '' : 'is-off'}>
                        <td><input type="checkbox" aria-label={`Import ${r.description}`} checked={selected.has(r.rowId)} onChange={() => toggle(r.rowId)} /></td>
                        <td className="nowrap">{shortDate(r.date)}</td>
                        <td className="import-desc">
                          <span title={r.description}>{r.description || '—'}</span>
                          {r.duplicate && <span className="import-flag">{r.duplicate === 'imported' ? 'Already imported' : 'Possible duplicate'}</span>}
                          {r.needsReview && !r.userEdited && r.direction === 'debit' && <span className="import-flag import-flag-review">Check label</span>}
                        </td>
                        <td>
                          {r.direction === 'debit' ? (
                            <select className="form-select" aria-label="Category" value={r.category} onChange={(e) => editRow(r.rowId, { category: e.target.value })}>
                              {CANONICAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <select className="form-select" aria-label="Income source" value={r.source} onChange={(e) => editRow(r.rowId, { source: e.target.value })}>
                              {COMMON_INCOME_SOURCES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          )}
                        </td>
                        <td>
                          {r.direction === 'debit' ? (
                            <select className="form-select" aria-label="Type" value={r.type} onChange={(e) => editRow(r.rowId, { type: e.target.value as TransactionType })}>
                              {VALID_TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : <span className="parity-muted">Income</span>}
                        </td>
                        <td className={`num ${r.direction === 'credit' ? 'import-in' : 'import-out'}`}>
                          {r.direction === 'credit' ? '+' : '−'}{formatCurrencyINR(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isBank && closing !== null && (
                <label className="import-balance-opt">
                  <input type="checkbox" checked={setBalance} onChange={(e) => setSetBalance(e.target.checked)} />
                  Also set my bank balance to the statement's closing balance, {formatCurrencyINR(closing)}
                </label>
              )}
              <p className="parity-hint">Imported rows are history only: they don't change your balance or card dues.</p>
              {error && <p className="parity-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
              <div className="parity-actions">
                <Button onClick={save} isLoading={saving} disabled={!chosen.length}>
                  Import {chosen.length} row{chosen.length === 1 ? '' : 's'}
                </Button>
                <span className="parity-muted import-totals">
                  {formatCurrencyINR(totals.out)} out · {formatCurrencyINR(totals.in)} in
                </span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ImportPage;
