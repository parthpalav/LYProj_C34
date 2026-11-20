import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, CheckCircle2, Undo2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { ImportProgressOverlay } from '../components/ui/ImportProgressOverlay';
import { COMMON_INCOME_SOURCES } from '../utils/incomeSources';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import axios from 'axios';
import { previewStatement, commitStatement, undoImport, apiErrorCode } from '../services/api';
import type { StatementPreview, StatementRow, StatementCommitResult } from '../services/api';
import { CANONICAL_CATEGORIES, VALID_TRANSACTION_TYPES } from '../types';
import type { TransactionType } from '../types';
import { PAYMENT_KIND_LABEL, paymentMethodLabel } from '../utils/paymentMethods';
import { formatCurrencyINR } from '../utils/formatters';
import { getAppTimezone } from '../utils/timezone';
import { fileToBase64 } from '../utils/fileData';

const MAX_BYTES = 6 * 1024 * 1024;
const MIN_WAIT_MS = 1200;
const PARSER_LABEL: Record<StatementPreview['parser'], string> = {
  csv: 'Read from CSV',
  gemini: 'Read by Gemini AI',
  local: 'Read by the offline parser',
};

const doneLabelFor = (p: StatementPreview) => {
  const expenses = p.rows.filter((r) => r.direction === 'debit').length;
  return `${p.rows.length} ${p.rows.length === 1 ? 'entry' : 'entries'} read · ${expenses} expense${expenses === 1 ? '' : 's'} classified`;
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
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [methodId, setMethodId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  // Preview that has arrived but waits for the ring to finish before the review shows.
  const [arrived, setArrived] = useState<StatementPreview | null>(null);
  const readAbort = useRef<AbortController | null>(null);
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
    setFile(null); setPassword(''); setNeedsPassword(false); setError(null); setMethodId('');
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
    if (!file || reading || (needsPassword && !password)) return;
    const controller = new AbortController();
    readAbort.current = controller;
    setReading(true);
    setError(null);
    setToast({ message: null, type: 'success' });
    try {
      const startedAt = Date.now();
      const data = await fileToBase64(file);
      if (controller.signal.aborted) return;
      const p = await previewStatement({ fileName: file.name, mimeType: file.type || '', data, password: password || undefined }, controller.signal);
      // A CSV answers in ~0.1 s: keep the wait screen up briefly so it reads as progress, not a flash.
      await new Promise((resolve) => { window.setTimeout(resolve, Math.max(0, MIN_WAIT_MS - (Date.now() - startedAt))); });
      if (controller.signal.aborted) return;
      setNeedsPassword(false);
      setPassword('');
      setArrived(p); // the overlay plays its finish, then showPreview() reveals the rows
    } catch (err) {
      setReading(false);
      if (axios.isCancel(err) || controller.signal.aborted) return;
      const code = apiErrorCode(err);
      if (code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT') {
        setNeedsPassword(true);
        setError(code === 'PASSWORD_INCORRECT' ? 'That password did not open the PDF.' : 'This PDF is password protected. Banks usually use your customer ID or date of birth.');
      } else {
        const message = (err as any)?.response?.data?.error;
        setError(message || ((err as any)?.code === 'ECONNABORTED' ? 'Reading took too long. Try again, or use the CSV.' : 'Could not read this statement.'));
      }
    } finally {
      if (readAbort.current === controller) readAbort.current = null;
    }
  };

  // Stops waiting. The server only reads the file (nothing is saved), so dropping the request is safe.
  const cancelRead = () => {
    if (arrived) return;
    readAbort.current?.abort();
    readAbort.current = null;
    setReading(false);
    setToast({ message: 'Import cancelled. Nothing was saved.', type: 'success' });
  };

  const showPreview = () => {
    const p = arrived;
    setArrived(null);
    setReading(false);
    if (!p) return;
    setPreview(p);
    setRows(p.rows);
    // Rows that look already recorded start unticked.
    setSelected(new Set(p.rows.filter((r) => !r.duplicate).map((r) => r.rowId)));
    if (p.suggestedPaymentMethodId && activeMethods.some((m) => m.id === p.suggestedPaymentMethodId)) setMethodId(p.suggestedPaymentMethodId);
  };
  useEffect(() => () => readAbort.current?.abort(), []);

  const editRow = (rowId: string, patch: Partial<StatementRow>) => {
    setRows((list) => list.map((r) => (r.rowId === rowId ? { ...r, ...patch, userEdited: true } : r)));
  };
  const toggle = (rowId: string) => {
    setSelected((s) => { const next = new Set(s); if (next.has(rowId)) next.delete(rowId); else next.add(rowId); return next; });
  };
  useEffect(() => { if (preview) reviewTitle.current?.focus(); }, [preview]);
  useEffect(() => { if (needsPassword) passwordInput.current?.focus(); }, [needsPassword]);

  const newRows = rows.filter((r) => !r.duplicate);
  const allNewSelected = newRows.length > 0 && newRows.every((r) => selected.has(r.rowId));

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.rowId)), [rows, selected]);
  const totals = useMemo(() => ({
    out: chosen.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amount, 0),
    in: chosen.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amount, 0),
  }), [chosen]);
  const isBank = methodId === '';
  const closing = preview?.summary.closingBalance ?? null;

  const save = async () => {
    if (!chosen.length || saving) return;
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
      setToast({ message: result.balanceSetTo === undefined ? 'Imported entries removed.' : 'Imported entries removed. The bank balance update is still in place.', type: 'success' });
      reset();
    } catch {
      setToast({ message: "Couldn't undo the import.", type: 'error' });
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="parity-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />
      {reading && <ImportProgressOverlay
        done={!!arrived}
        fileName={file?.name ?? ''}
        slow={!!file && /\.pdf$/i.test(file.name)}
        doneLabel={arrived ? doneLabelFor(arrived) : ''}
        onCancel={cancelRead}
        onFinished={showPreview}
      />}
      <PageHeader
        title="Import bank statement"
        category="ACTIVITY"
        description="Add months of history at once from your bank's CSV or PDF statement."
        actions={<Link className="next-step-action" to="/app/activity">Back to Activity</Link>}
      />

      {result ? (
        <section className="parity-card import-done">
          <CheckCircle2 size={36} className="import-done-icon" aria-hidden="true" />
          <h2>{result.insertedTransactions + result.insertedIncome > 0 ? 'Statement imported' : 'No new entries imported'}</h2>
          <p className="parity-muted">
            {result.insertedTransactions} expense{result.insertedTransactions === 1 ? '' : 's'} and {result.insertedIncome} income entr{result.insertedIncome === 1 ? 'y' : 'ies'} added
            {result.skipped ? `, ${result.skipped} already imported` : ''}.
            {result.balanceSetTo !== undefined ? ` Bank balance set to ${formatCurrencyINR(result.balanceSetTo)}.` : ' Your balances were not changed.'}
          </p>
          {result.insertedTransactions > 0 && chosen.some((r) => r.needsReview && !r.userEdited) && (
            <p className="parity-muted">Some labels need a second look. <Link to="/app/review">Check AI guesses</Link></p>
          )}
          {result.balanceSetTo !== undefined && <p className="parity-muted">Undo removes the entries. Your bank balance will stay at the updated amount.</p>}
          <div className="parity-actions">
            <Link className="next-step-action" to="/app/activity">View in Activity</Link>
            {result.insertedTransactions + result.insertedIncome > 0 && <Button variant="outline" leftIcon={<Undo2 size={16} />} onClick={undo} isLoading={undoing}>Undo import</Button>}
            <Button variant="ghost" onClick={reset}>Import another</Button>
          </div>
        </section>
      ) : (
        <>
          {!preview && <section className="parity-card">
            <h2>Choose a statement</h2>
            <p className="parity-muted">CSV from net banking works best. PDF statements work too, including password-protected ones.</p>
            {error && <p className="parity-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}

            <div
              className={`import-drop${dragging ? ' is-dragging' : ''}`}
              role="button"
              tabIndex={reading ? -1 : 0}
              aria-disabled={reading}
              onClick={() => { if (!reading) fileInput.current?.click(); }}
              onKeyDown={(e) => { if (!reading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInput.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (!reading) pickFile(e.dataTransfer.files?.[0]); }}
            >
              <FileUp size={28} aria-hidden="true" />
              <strong>{file ? file.name : 'Drop a CSV or PDF here, or click to choose'}</strong>
              <span>{file ? `${Math.ceil(file.size / 1024)} KB` : 'Up to 6 MB'}</span>
            </div>
            <input ref={fileInput} type="file" accept=".csv,.pdf,text/csv,application/pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />

            <div className="parity-grid-2" style={{ marginTop: 16 }}>
              {needsPassword && (
                <div className="form-group">
                  <label htmlFor="imp-password" className="form-label">PDF password</label>
                  <input ref={passwordInput} id="imp-password" type="password" className="form-input" value={password} autoComplete="off" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') read(); }} />
                </div>
              )}
            </div>
            <p className="parity-hint">The file is read once and not stored. FINAURA can send PDF text to Google Gemini. Long digit sequences are partially masked, but names and transaction details may remain. If Gemini is unavailable, the server reads the PDF locally.</p>
            <div className="parity-actions">
              <Button onClick={read} isLoading={reading} disabled={!file || (needsPassword && !password)}>
                {reading ? 'Reading statement…' : 'Read statement'}
              </Button>
            </div>
          </section>}

          {preview && (
            <section className="parity-card">
              <div className="import-summary-head">
                <h2 ref={reviewTitle} tabIndex={-1}>Review {rows.length} {rows.length === 1 ? 'entry' : 'entries'}</h2>
                <span className={`import-parser import-parser-${preview.parser}`}>{PARSER_LABEL[preview.parser]}</span>
              </div>
              <p className="parity-muted">
                {shortDate(preview.summary.periodStart)} – {shortDate(preview.summary.periodEnd)}
                {preview.summary.last4 ? ` · account ending ${preview.summary.last4}` : ''}
                {preview.fallbackReason ? ' · Gemini was unavailable' : ''}
              </p>
              {preview.summary.duplicates > 0 && (
                <p className="parity-muted">Possible duplicates start unchecked. Entries already imported are skipped.</p>
              )}
              <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>Choose a different statement</Button>

              <div className="form-group">
                <label htmlFor="imp-method" className="form-label">Payment method for expenses</label>
                <select id="imp-method" className="form-select" value={methodId} onChange={(e) => { setMethodId(e.target.value); setSetBalance(false); }}>
                  <option value="">Bank account</option>
                  {activeMethods.map((m) => (
                    <option key={m.id} value={m.id}>{PAYMENT_KIND_LABEL[m.kind]} · {paymentMethodLabel(m)}</option>
                  ))}
                </select>
              </div>

              <div className="import-table-wrap">
                <table className="import-table" role="table" aria-label="Statement entries">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader"><label className="import-select-all"><input type="checkbox" checked={allNewSelected} disabled={!newRows.length} onChange={() => setSelected(allNewSelected ? new Set() : new Set(newRows.map((r) => r.rowId)))} /> Select new entries</label></th>
                      <th role="columnheader">Date</th>
                      <th role="columnheader">Description</th>
                      <th role="columnheader">Category / source</th>
                      <th role="columnheader">Type</th>
                      <th role="columnheader" className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {rows.map((r) => (
                      <tr role="row" key={r.rowId} className={selected.has(r.rowId) ? '' : 'is-off'}>
                        <td role="cell"><input type="checkbox" aria-label={`Import ${r.description}`} disabled={r.duplicate === 'imported'} checked={selected.has(r.rowId)} onChange={() => toggle(r.rowId)} /></td>
                        <td role="cell" className="nowrap">{shortDate(r.date)}</td>
                        <td role="cell" className="import-desc">
                          <span title={r.description}>{r.description || '—'}</span>
                          {r.duplicate && <span className="import-flag">{r.duplicate === 'imported' ? 'Already imported' : 'Possible duplicate'}</span>}
                          {r.needsReview && !r.userEdited && r.direction === 'debit' && <span className="import-flag import-flag-review">Check label</span>}
                        </td>
                        <td role="cell" className="import-label">
                          {r.direction === 'debit' ? (
                            <select className="form-select" disabled={r.duplicate === 'imported'} aria-label={`Category for ${r.description}`} value={r.category} onChange={(e) => editRow(r.rowId, { category: e.target.value })}>
                              {CANONICAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <select className="form-select" disabled={r.duplicate === 'imported'} aria-label={`Income source for ${r.description}`} value={r.source} onChange={(e) => editRow(r.rowId, { source: e.target.value })}>
                              {COMMON_INCOME_SOURCES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          )}
                        </td>
                        <td role="cell" className="import-type">
                          {r.direction === 'debit' ? (
                            <select className="form-select" disabled={r.duplicate === 'imported'} aria-label={`Type for ${r.description}`} value={r.type} onChange={(e) => editRow(r.rowId, { type: e.target.value as TransactionType })}>
                              {VALID_TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : <span className="parity-muted">Income</span>}
                        </td>
                        <td role="cell" className={`num ${r.direction === 'credit' ? 'import-in' : 'import-out'}`}>
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
                  Set my bank balance to {formatCurrencyINR(closing)}, the closing balance on {shortDate(preview.summary.periodEnd)}
                </label>
              )}
              <p className="parity-hint">Imported entries add to your history. The optional balance update replaces your current bank balance and stays in place if you undo the import. Card dues stay the same.</p>
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
