// Bank statement import: turns a CSV or PDF statement into transaction/income rows.
//
// CSV is parsed here. PDFs are decrypted and read to text lines here, then Gemini
// extracts the rows; if Gemini fails or its rows do not add up, a generic local
// line parser takes over. Imports are history only: they never move balances.
import crypto from 'node:crypto';
import { parse as parseCsv } from 'csv-parse/sync';
import Transaction, { VALID_CATEGORIES, VALID_TYPES, CLASSIFICATION_SOURCE_RE } from '../models/Transaction.js';
import Income from '../models/Income.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { fromZoned, toZoned, DEFAULT_TIMEZONE } from '../utils/userTime.js';
import { recallMerchant, memoryResult, merchantKey } from './MerchantMemoryService.js';
import { classifyLocally } from './LocalClassifier.js';
import { generateJson } from './GeminiJson.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
export const MAX_IMPORT_ROWS = 1000;
const MAX_PDF_PAGES = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export class ImportError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── Small parsers ────────────────────────────────────────────

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Amount text like "₹1,23,456.78 Cr" → { value: 123456.78, marker: 'cr' }, or null. */
export function parseAmount(raw) {
  if (raw === undefined || raw === null) return null;
  let text = String(raw).trim().toLowerCase();
  if (!text || text === '-' || text === '--') return null;
  let marker = null;
  const m = text.match(/\b(cr|dr)\.?$/);
  if (m) { marker = m[1]; text = text.slice(0, m.index); }
  const negative = /^\(.*\)$/.test(text.trim()) || /^-/.test(text.trim());
  text = text.replace(/₹|inr|rs\.?|[,\s()]/g, '').replace(/^-/, '');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return { value: Math.round(value * 100) / 100, marker, negative };
}

/** Day-first statement date → Date at local noon in `tz` (noon keeps the calendar day in any zone), or null. */
export function parseStatementDate(raw, tz = DEFAULT_TIMEZONE) {
  const text = String(raw || '').trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let y; let mo; let d;
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; }
  if (!m) {
    m = text.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})\b/);
    if (m) { [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]; }
  }
  if (!m) {
    m = text.match(/^(\d{1,2})[/\-. ]?([a-z]{3,4})[a-z]*[/\-. ]?(\d{2,4})\b/);
    if (m && MONTHS[m[2]]) { [d, mo, y] = [Number(m[1]), MONTHS[m[2]], Number(m[3])]; } else m = null;
  }
  if (!m) return null;
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const zoned = new Date(Date.UTC(y, mo - 1, d, 12));
  if (zoned.getUTCDate() !== d) return null; // 31/02 etc.
  return fromZoned(zoned, tz);
}

const dayKey = (date, tz) => toZoned(date, tz).toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;
const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function findLast4(text) {
  const m = String(text).match(/(?:a\/c|acct|account|card)\s*(?:no\.?|number|num)?\s*[:.-]?\s*[x*\d\s-]*?(\d{4})\b/i);
  return m ? m[1] : null;
}

const CREDIT_HINT = /\b(cr|credit(ed)?|deposit(ed)?|salary|refund|reversal|cashback|received|interest paid|by transfer|by clg|neft cr|imps cr|upi cr)\b/i;

// Puts rows oldest-first and fills direction from balance changes where the parser could not tell.
function finishRows(rows, openingBalance = null) {
  const valid = rows.filter((r) => r.date && r.amount > 0);
  if (valid.length > 1 && valid[0].date > valid[valid.length - 1].date) valid.reverse();
  let prev = openingBalance;
  for (const row of valid) {
    if (!row.direction && prev !== null && row.balance !== null && row.balance !== undefined) {
      const delta = round2(row.balance - prev);
      if (Math.abs(delta - row.amount) < 0.011) row.direction = 'credit';
      else if (Math.abs(delta + row.amount) < 0.011) row.direction = 'debit';
    }
    if (!row.direction && row.marker) row.direction = row.marker === 'cr' ? 'credit' : 'debit';
    if (!row.direction) row.direction = CREDIT_HINT.test(row.description) ? 'credit' : 'debit';
    if (row.balance !== null && row.balance !== undefined) prev = row.balance;
    delete row.marker;
  }
  const first = valid[0];
  const last = valid[valid.length - 1];
  const opening = openingBalance ?? (first && first.balance != null
    ? round2(first.balance + (first.direction === 'debit' ? first.amount : -first.amount))
    : null);
  return {
    rows: valid,
    meta: {
      openingBalance: opening,
      closingBalance: last && last.balance != null ? last.balance : null,
      periodStart: first ? first.date : null,
      periodEnd: last ? last.date : null,
    },
  };
}

// ── CSV ──────────────────────────────────────────────────────

function headerIndexes(row) {
  const cells = row.map((c) => cleanText(c).toLowerCase());
  const find = (re, skip = []) => cells.findIndex((c, i) => c && re.test(c) && !skip.includes(i));
  const drcr = find(/(dr|debit)\s*\/\s*(cr|credit)|(cr|credit)\s*\/\s*(dr|debit)|^type$|^txn type$|^transaction type$/);
  const skip = drcr >= 0 ? [drcr] : [];
  let date = find(/^(txn|tran|transaction|posting|value)?\.?\s*date/, skip);
  const txnDate = find(/(txn|tran|transaction|posting)\.?\s*date|^date$/, skip);
  if (txnDate >= 0) date = txnDate;
  const debit = find(/withdrawal|debit|^dr\.?$|paid out|money out/, skip);
  const credit = find(/deposit|credit|^cr\.?$|paid in|money in/, skip);
  const amount = find(/^(txn\.?\s*|transaction\s*)?amount|^amt/, [...skip, debit, credit]);
  const balance = find(/balance/, skip);
  const desc = find(/narration|description|particulars|remarks|details|transaction remarks/, skip);
  return { date, debit, credit, amount, drcr, balance, desc };
}

/** CSV statement text → { rows, meta }. Rows: { date, description, amount, direction, balance }. */
export function parseCsvStatement(text, tz = DEFAULT_TIMEZONE) {
  let records;
  try {
    records = parseCsv(text, { relax_column_count: true, relax_quotes: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    throw new ImportError(422, 'UNREADABLE_CSV', `Could not read this CSV: ${err.message}`);
  }
  let headerAt = -1;
  let idx = null;
  for (let i = 0; i < Math.min(records.length, 40); i += 1) {
    const h = headerIndexes(records[i]);
    if (h.date >= 0 && (h.debit >= 0 || h.credit >= 0 || h.amount >= 0)) { headerAt = i; idx = h; break; }
  }
  if (headerAt < 0) {
    throw new ImportError(422, 'NO_HEADER', 'Could not find the transaction table. The CSV needs a date column and a debit/credit or amount column.');
  }

  const rows = [];
  for (const rec of records.slice(headerAt + 1)) {
    const date = parseStatementDate(rec[idx.date], tz);
    if (!date) continue; // separator, footer and summary lines
    const description = cleanText(idx.desc >= 0 ? rec[idx.desc] : rec.filter((c, i) => i !== idx.date && !parseAmount(c)).join(' '));
    const balance = idx.balance >= 0 ? parseAmount(rec[idx.balance])?.value ?? null : null;
    let amount = null;
    let direction = null;
    let marker = null;
    const debit = idx.debit >= 0 ? parseAmount(rec[idx.debit]) : null;
    const credit = idx.credit >= 0 ? parseAmount(rec[idx.credit]) : null;
    if (debit && debit.value > 0) { amount = debit.value; direction = 'debit'; }
    else if (credit && credit.value > 0) { amount = credit.value; direction = 'credit'; }
    else if (idx.amount >= 0) {
      const a = parseAmount(rec[idx.amount]);
      if (a && a.value > 0) {
        amount = a.value;
        const kind = idx.drcr >= 0 ? cleanText(rec[idx.drcr]).toLowerCase() : '';
        if (/^(cr|credit|c)\b/.test(kind)) direction = 'credit';
        else if (/^(dr|debit|d)\b/.test(kind)) direction = 'debit';
        else if (a.negative) direction = 'debit';
        else marker = a.marker;
      }
    }
    if (!amount) continue;
    rows.push({ date, description: description.slice(0, 300), amount, direction, balance, marker });
  }
  const result = finishRows(rows);
  result.meta.last4 = findLast4(records.slice(0, headerAt).map((r) => r.join(' ')).join('\n'));
  return result;
}

// ── PDF ──────────────────────────────────────────────────────

/** PDF bytes → text lines in reading order, cells separated by 3 spaces. Handles password-protected files. */
export async function extractPdfLines(buffer, password) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let doc;
  let task;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password: password || undefined,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    doc = await task.promise;
  } catch (err) {
    await task?.destroy();
    if (err?.name === 'PasswordException') {
      // pdf.js: code 1 = password needed, 2 = wrong password
      if (err.code === 2) throw new ImportError(422, 'PASSWORD_INCORRECT', 'That password did not open the PDF.');
      throw new ImportError(422, 'PASSWORD_REQUIRED', 'This PDF is password protected. Enter its password.');
    }
    throw new ImportError(422, 'UNREADABLE_PDF', 'Could not open this PDF.');
  }

  const lines = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p += 1) {
      const page = await doc.getPage(p);
      const { items } = await page.getTextContent();
      const rows = [];
      for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, end: x + (it.width || 0), str: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        let text = '';
        let prevEnd = null;
        for (const it of row.items) {
          if (prevEnd !== null) text += it.x - prevEnd > 6 ? '   ' : (it.x - prevEnd > 0.5 ? ' ' : '');
          text += it.str;
          prevEnd = it.end;
        }
        const line = text.trim();
        if (line) lines.push(line);
      }
    }
  } finally {
    await task.destroy();
  }
  if (!lines.length) {
    throw new ImportError(422, 'NO_TEXT', 'This PDF has no readable text (it may be a scanned image). Download the CSV from net banking instead.');
  }
  return lines;
}

const MONEY_RE = /(?<![\w.,/])-?(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}(?:\s?(?:cr|dr)\b)?(?![\d/])/gi;
const DATE_START_RE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/\-. ](?:\d{1,2}|[a-z]{3,4})[/\-. ,]{0,2}\d{2,4})(?=\s|$)/i;
const NOISE_RE = /^(page \d+|statement of account|this is a (computer|system) generated|\*{3,}|-{5,}|total\b|grand total)/i;

/** Generic statement line parser used when Gemini is unavailable. */
export function parseStatementLines(lines, tz = DEFAULT_TIMEZONE) {
  let openingBalance = null;
  const rows = [];
  let current = null;
  for (const raw of lines) {
    const line = cleanText(raw);
    if (!line || NOISE_RE.test(line)) { current = null; continue; }
    if (/opening balance|balance b\/?f|brought forward/i.test(line)) {
      const money = line.match(MONEY_RE);
      if (money) openingBalance = parseAmount(money[money.length - 1])?.value ?? openingBalance;
      current = null;
      continue;
    }
    if (/closing balance|balance c\/?f|carried forward/i.test(line)) { current = null; continue; }

    const dm = line.match(DATE_START_RE);
    const date = dm ? parseStatementDate(dm[1], tz) : null;
    if (date) {
      let rest = line.slice(dm[0].length).trim();
      const vd = rest.match(DATE_START_RE); // value date column
      if (vd && parseStatementDate(vd[1], tz)) rest = rest.slice(vd[0].length).trim();
      current = { date, description: '', amount: 0, direction: null, balance: null, marker: null };
      fillAmounts(current, rest);
      rows.push(current);
    } else if (current) {
      if (!current.amount) fillAmounts(current, line);
      else current.description = cleanText(`${current.description} ${line.replace(MONEY_RE, ' ')}`).slice(0, 300);
    }
  }
  return finishRows(rows, openingBalance);
}

// Reads the description and the trailing money columns (amount[, amount], balance) of a statement line.
function fillAmounts(row, text) {
  const money = [...text.matchAll(MONEY_RE)];
  const firstAt = money.length ? money[0].index : text.length;
  row.description = cleanText(`${row.description} ${text.slice(0, firstAt)}`).slice(0, 300);
  const values = money.map((m) => parseAmount(m[0])).filter(Boolean);
  if (!values.length) return;
  if (values.length >= 3) {
    // withdrawal, deposit, balance: one of the first two is 0.00
    const [d, c, b] = values.slice(-3);
    if (d.value > 0 && c.value === 0) { row.amount = d.value; row.direction = 'debit'; row.balance = b.value; return; }
    if (c.value > 0 && d.value === 0) { row.amount = c.value; row.direction = 'credit'; row.balance = b.value; return; }
  }
  if (values.length >= 2) {
    const a = values[values.length - 2];
    row.amount = a.value;
    row.marker = a.marker;
    row.balance = values[values.length - 1].value;
  } else {
    row.amount = values[0].value;
    row.marker = values[0].marker;
  }
}

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    openingBalance: { type: 'number', nullable: true },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Transaction date as YYYY-MM-DD' },
          description: { type: 'string' },
          amount: { type: 'number', description: 'Always positive' },
          direction: { type: 'string', enum: ['debit', 'credit'] },
          balance: { type: 'number', nullable: true },
        },
        required: ['date', 'description', 'amount', 'direction'],
      },
    },
  },
  required: ['rows'],
};

// Account and reference numbers are not needed to read the rows.
export const maskLongNumbers = (text) => text.replace(/\d{9,}/g, (m) => 'X'.repeat(m.length - 4) + m.slice(-4));

/** Gemini row extraction. Throws (GeminiUnavailableError or ImportError) when the answer is unusable. */
export async function parseLinesWithGemini(lines, tz = DEFAULT_TIMEZONE) {
  const text = maskLongNumbers(lines.join('\n')).slice(0, 150000);
  const out = await generateJson({
    schema: GEMINI_SCHEMA,
    timeoutMs: 35000,
    parts: [
      'Extract every transaction from this Indian bank account or credit card statement. '
      + 'Dates in the statement are day-first (DD/MM/YYYY); return them as YYYY-MM-DD. '
      + 'direction is "debit" for money going out (withdrawals, purchases, UPI/NEFT sent, charges) and "credit" for money coming in. '
      + 'amount is always positive. balance is the running balance after the row when the statement shows one, else null. '
      + 'Join multi-line narrations into one description. Skip headers, opening/closing balance lines, totals and page footers. '
      + 'openingBalance is the opening balance if shown, else null.\n\n' + text,
    ],
  });
  const rows = (Array.isArray(out?.rows) ? out.rows : []).map((r) => ({
    date: parseStatementDate(r.date, tz),
    description: cleanText(r.description).slice(0, 300),
    amount: round2(Math.abs(Number(r.amount))),
    direction: r.direction === 'credit' ? 'credit' : r.direction === 'debit' ? 'debit' : null,
    balance: Number.isFinite(r.balance) ? round2(r.balance) : null,
  }));
  const usable = rows.filter((r) => r.date && r.amount > 0 && r.direction);
  if (!usable.length || usable.length < rows.length * 0.9) {
    throw new ImportError(502, 'GEMINI_BAD_ROWS', 'Gemini returned rows that could not be read');
  }
  const result = finishRows(usable, Number.isFinite(out.openingBalance) ? out.openingBalance : null);
  if (!balancesAddUp(result.rows, result.meta.openingBalance)) {
    throw new ImportError(502, 'GEMINI_BAD_ROWS', 'Gemini rows do not match the running balance');
  }
  return result;
}

// True when at least 90% of rows that can be checked satisfy prev ± amount = balance.
export function balancesAddUp(rows, openingBalance) {
  let prev = openingBalance;
  let checked = 0;
  let ok = 0;
  for (const r of rows) {
    if (prev !== null && r.balance !== null && r.balance !== undefined) {
      checked += 1;
      const expected = prev + (r.direction === 'credit' ? r.amount : -r.amount);
      if (Math.abs(expected - r.balance) < 1) ok += 1;
    }
    if (r.balance !== null && r.balance !== undefined) prev = r.balance;
  }
  return checked < 3 || ok / checked >= 0.9;
}

// ── Classification ───────────────────────────────────────────

const isClassificationSource = (s) => typeof s === 'string' && CLASSIFICATION_SOURCE_RE.test(s);

function normalizeLabel(category, type) {
  const cat = VALID_CATEGORIES.find((c) => c.toLowerCase() === String(category || '').toLowerCase()) || 'Misc';
  return { category: cat, type: VALID_TYPES.includes(type) ? type : 'Need' };
}

function labelFrom(d, fallbackSource) {
  const { category, type } = normalizeLabel(d.category, d.type);
  const confidence = typeof d.confidenceScore === 'number' ? d.confidenceScore : (d.confidence || 0);
  const source = d.classificationSource || fallbackSource;
  return {
    category,
    type,
    confidenceScore: confidence,
    classificationSource: isClassificationSource(source) ? source : 'unknown',
    categorySource: d.categorySource || source,
    typeSource: d.typeSource || source,
    categoryConfidence: typeof d.categoryConfidence === 'number' ? d.categoryConfidence : confidence,
    typeConfidence: typeof d.typeConfidence === 'number' ? d.typeConfidence : confidence,
    needsReview: typeof d.needsReview === 'boolean' ? d.needsReview : confidence < 0.6,
  };
}

/** Labels many descriptions: the user's merchant memory first, then one ML batch call, then keywords. */
export async function classifyMany(userId, texts) {
  const results = new Array(texts.length).fill(null);
  const memo = new Map();
  for (let i = 0; i < texts.length; i += 1) {
    const key = merchantKey(texts[i]);
    if (!memo.has(key)) memo.set(key, key ? await recallMerchant(userId, texts[i]).catch(() => null) : null);
    const pref = memo.get(key);
    if (pref) results[i] = labelFrom(memoryResult(pref), 'user_memory');
  }
  const pending = texts.map((t, i) => (results[i] ? -1 : i)).filter((i) => i >= 0);
  for (let start = 0; start < pending.length; start += 500) {
    const chunk = pending.slice(start, start + 500);
    try {
      const resp = await fetch(`${ML_SERVICE_URL}/classify-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk.map((i) => (texts[i] || 'unknown').slice(0, 1000)) }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`ML service responded ${resp.status}`);
      const { results: labels } = await resp.json();
      chunk.forEach((i, k) => { results[i] = labelFrom(labels[k] || {}, 'ml'); });
    } catch (err) {
      console.warn('[import] ML batch classify failed, using keyword fallback:', err.message || err);
      chunk.forEach((i) => { results[i] = labelFrom(classifyLocally(texts[i] || ''), 'fallback'); });
    }
  }
  return results;
}

// ── Preview / commit ─────────────────────────────────────────

/** Stable id for a statement line, so re-importing the same statement is a no-op. */
export function importHash(userId, row, tz, occurrence) {
  const anchor = row.balance !== null && row.balance !== undefined ? `b${row.balance.toFixed(2)}` : merchantKey(row.description);
  const raw = [userId, dayKey(row.date, tz), row.amount.toFixed(2), row.direction, anchor, occurrence].join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function withHashes(userId, rows, tz) {
  const seen = new Map();
  return rows.map((row) => {
    const base = importHash(userId, row, tz, 0);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return { ...row, importHash: n === 0 ? base : importHash(userId, row, tz, n) };
  });
}

const incomeSourceFor = (description) => {
  if (/\b(salary|sal|payroll)\b/i.test(description)) return 'salary';
  if (/\b(refund|reversal|reversed|cashback)\b/i.test(description)) return 'reimbursement';
  if (/\b(interest|dividend)\b/i.test(description)) return 'investments';
  return 'other';
};

/** Reads the uploaded file into rows. Picks CSV, or PDF via Gemini with local fallback. */
export async function parseStatementFile({ fileName = '', mimeType = '', buffer, password }, tz, { allowGemini = true } = {}) {
  const isPdf = /pdf/i.test(mimeType) || /\.pdf$/i.test(fileName) || buffer.subarray(0, 5).toString() === '%PDF-';
  if (!isPdf) {
    if (!/csv|text|excel|octet/i.test(mimeType || 'text/csv') && !/\.csv$/i.test(fileName)) {
      throw new ImportError(415, 'UNSUPPORTED_FILE', 'Upload a CSV or PDF statement.');
    }
    return { parser: 'csv', ...parseCsvStatement(buffer.toString('utf8'), tz) };
  }
  const lines = await extractPdfLines(buffer, password);
  const last4 = findLast4(lines.slice(0, 30).join('\n'));
  const local = () => ({ parser: 'local', ...parseStatementLines(lines, tz) });
  let result;
  if (!allowGemini) result = local();
  else {
    try {
      result = { parser: 'gemini', ...(await parseLinesWithGemini(lines, tz)) };
    } catch (err) {
      console.warn('[import] Gemini statement parse failed, using local parser:', err.message || err);
      result = { ...local(), fallbackReason: err.code || err.name || 'error' };
    }
  }
  result.meta.last4 = last4;
  return result;
}

/** Builds the preview the client reviews before committing. Nothing is written. */
export async function buildPreview(userId, file, tz, options) {
  const parsed = await parseStatementFile(file, tz, options);
  let rows = parsed.rows;
  if (!rows.length) throw new ImportError(422, 'NO_ROWS', 'No transactions were found in this statement.');
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(422, 'TOO_MANY_ROWS', `This statement has ${rows.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time (split it by date range).`);
  }
  rows = withHashes(userId, rows, tz);

  const debitIdx = rows.map((r, i) => (r.direction === 'debit' ? i : -1)).filter((i) => i >= 0);
  const labels = await classifyMany(userId, debitIdx.map((i) => rows[i].description));
  const labelAt = new Map(debitIdx.map((i, k) => [i, labels[k]]));

  const from = new Date(rows[0].date.getTime() - 2 * DAY_MS);
  const to = new Date(rows[rows.length - 1].date.getTime() + 2 * DAY_MS);
  const hashes = rows.map((r) => r.importHash);
  const range = { userId: String(userId), timestamp: { $gte: from, $lte: to } };
  const [txs, incomes] = await Promise.all([
    Transaction.find(range, { amount: 1, timestamp: 1, importHash: 1, _id: 0 }).lean(),
    Income.find(range, { amount: 1, timestamp: 1, importHash: 1, _id: 0 }).lean(),
  ]);
  const imported = new Set([...txs, ...incomes].map((d) => d.importHash).filter(Boolean));
  const near = (list, row) => list.some((d) => !d.importHash && Math.abs(d.amount - row.amount) < 0.01
    && Math.abs(d.timestamp.getTime() - row.date.getTime()) <= 1.5 * DAY_MS);

  let suggestedPaymentMethodId;
  if (parsed.meta.last4) {
    const method = await PaymentMethod.findOne({ userId: String(userId), status: 'active', last4: parsed.meta.last4 }).lean();
    if (method) suggestedPaymentMethodId = method.id;
  }

  const out = rows.map((row, i) => {
    const duplicate = imported.has(hashes[i]) ? 'imported'
      : near(row.direction === 'debit' ? txs : incomes, row) ? 'possible' : null;
    const label = labelAt.get(i);
    return {
      rowId: row.importHash,
      date: row.date.toISOString(),
      description: row.description,
      amount: row.amount,
      direction: row.direction,
      balance: row.balance ?? null,
      duplicate,
      ...(label ? { category: label.category, type: label.type, confidence: label.confidenceScore, needsReview: label.needsReview, classificationSource: label.classificationSource }
        : { source: incomeSourceFor(row.description) }),
    };
  });

  const sum = (dir) => round2(out.filter((r) => r.direction === dir).reduce((s, r) => s + r.amount, 0));
  return {
    parser: parsed.parser,
    ...(parsed.fallbackReason ? { fallbackReason: parsed.fallbackReason } : {}),
    rows: out,
    summary: {
      count: out.length,
      debits: sum('debit'),
      credits: sum('credit'),
      duplicates: out.filter((r) => r.duplicate).length,
      openingBalance: parsed.meta.openingBalance,
      closingBalance: parsed.meta.closingBalance,
      periodStart: parsed.meta.periodStart?.toISOString() ?? null,
      periodEnd: parsed.meta.periodEnd?.toISOString() ?? null,
      last4: parsed.meta.last4 ?? null,
    },
    ...(suggestedPaymentMethodId ? { suggestedPaymentMethodId } : {}),
  };
}

/** Validates client-edited preview rows for commit. Throws ImportError on bad input. */
export function validateCommitRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new ImportError(400, 'NO_ROWS', 'Select at least one row to import.');
  if (rows.length > MAX_IMPORT_ROWS) throw new ImportError(400, 'TOO_MANY_ROWS', `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  return rows.map((r, i) => {
    const amount = Number(r?.amount);
    const date = new Date(r?.date);
    const bad = (msg) => new ImportError(400, 'BAD_ROW', `Row ${i + 1}: ${msg}`);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw bad('amount must be a positive number');
    if (Number.isNaN(date.getTime())) throw bad('invalid date');
    if (r.direction !== 'debit' && r.direction !== 'credit') throw bad('direction must be debit or credit');
    if (typeof r.rowId !== 'string' || !/^[a-f0-9]{40}$/.test(r.rowId)) throw bad('missing row id');
    const description = cleanText(r.description).slice(0, 500);
    if (r.direction === 'credit') {
      const source = typeof r.source === 'string' && r.source.length <= 200 ? r.source : incomeSourceFor(description);
      return { rowId: r.rowId, amount: round2(amount), date, direction: 'credit', description, source };
    }
    const { category, type } = normalizeLabel(r.category, r.type);
    const confidence = Number(r.confidence);
    return {
      rowId: r.rowId,
      amount: round2(amount),
      date,
      direction: 'debit',
      description,
      category,
      type,
      confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0,
      needsReview: r.needsReview === true,
      classificationSource: isClassificationSource(r.classificationSource) ? r.classificationSource : 'unknown',
      userEdited: r.userEdited === true,
    };
  });
}

/** Writes validated rows. History only: balances are not touched. */
export async function commitRows(userId, paymentMethodId, rows) {
  const batchId = `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const txDocs = [];
  const incomeDocs = [];
  rows.forEach((r, i) => {
    if (r.direction === 'credit') {
      incomeDocs.push({
        id: `i-imp-${batchId}-${i}`, userId: String(userId), amount: r.amount, source: r.source,
        description: r.description, timestamp: r.date, importBatchId: batchId, importHash: r.rowId,
      });
    } else {
      const src = r.userEdited ? 'manual' : r.classificationSource;
      txDocs.push({
        id: `t-imp-${batchId}-${i}`, userId: String(userId), amount: r.amount, category: r.category, type: r.type,
        description: r.description, timestamp: r.date, confidenceScore: r.confidence,
        classificationSource: src, categorySource: src, typeSource: src,
        categoryConfidence: r.confidence, typeConfidence: r.confidence,
        needsReview: r.userEdited ? false : r.needsReview,
        sentiment: 'neutral', paymentMethodId, importBatchId: batchId, importHash: r.rowId,
      });
    }
  });
  const insert = async (Model, docs) => {
    if (!docs.length) return { inserted: 0, skipped: 0 };
    try {
      const res = await Model.insertMany(docs, { ordered: false });
      return { inserted: res.length, skipped: 0 };
    } catch (err) {
      // Duplicate importHash rows (already imported) are skipped; anything else is a real failure.
      const writeErrors = err.writeErrors || [];
      if (!writeErrors.length || writeErrors.some((e) => (e.code ?? e.err?.code) !== 11000)) throw err;
      return { inserted: docs.length - writeErrors.length, skipped: writeErrors.length };
    }
  };
  const tx = await insert(Transaction, txDocs);
  const inc = await insert(Income, incomeDocs);
  return {
    batchId,
    insertedTransactions: tx.inserted,
    insertedIncome: inc.inserted,
    skipped: tx.skipped + inc.skipped,
  };
}

/** Undo: removes one import batch for this user. */
export async function deleteBatch(userId, batchId) {
  const filter = { userId: String(userId), importBatchId: String(batchId) };
  const [tx, inc] = await Promise.all([Transaction.deleteMany(filter), Income.deleteMany(filter)]);
  return { deletedTransactions: tx.deletedCount, deletedIncome: inc.deletedCount };
}
