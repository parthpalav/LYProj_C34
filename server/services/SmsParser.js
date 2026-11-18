// Reads Indian bank transaction SMS (HDFC, SBI, ICICI, Axis, Kotak and similar formats).
// Regexes first; Gemini only when they cannot find an amount and a direction.
import PaymentMethod from '../models/PaymentMethod.js';
import { parseStatementDate, parseAmount, classifyMany } from './StatementImportService.js';
import { generateJson, GeminiUnavailableError } from './GeminiJson.js';
import { DEFAULT_TIMEZONE } from '../utils/userTime.js';

export class SmsParseError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NOT_A_TRANSACTION = /\b(otp|one[- ]time password|verification code)\b|will be (debited|deducted|charged)|is due\b|due on\b|payment due|requested money|collect request|has requested/i;
const PROMO = /pre-?approved|apply now|congratulations|\bwin\b|limited period|loan of|upgrade your|exclusive offer/i;
const DEBIT_WORD = /\b(debited|spent|paid|sent|withdrawn|purchase|charged|dr)\b/i;
const CREDIT_WORD = /\b(credited|received|deposited|refunded|refund|cr)\b/i;
const CURRENCY_AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const NAME = "[A-Za-z0-9][A-Za-z0-9 &.'@_*-]{1,40}?";

function findAmount(text) {
  for (const m of text.matchAll(CURRENCY_AMOUNT)) {
    // Skip "Avl Bal Rs ..." and "Avl Limit: INR ..." figures
    if (/(avl|available|bal|balance|limit|lmt)\W*$/i.test(text.slice(Math.max(0, m.index - 20), m.index))) continue;
    const a = parseAmount(m[1]);
    if (a && a.value > 0) return a.value;
  }
  const bare = text.match(/\b(?:debited|credited)\s+(?:by|with|for)\s+([\d,]+(?:\.\d{1,2})?)/i);
  const a = bare ? parseAmount(bare[1]) : null;
  return a && a.value > 0 ? a.value : null;
}

function findDirection(text) {
  const d = text.search(DEBIT_WORD);
  const c = text.search(CREDIT_WORD);
  if (d < 0 && c < 0) return null;
  if (c < 0) return 'debit';
  if (d < 0) return 'credit';
  return d < c ? 'debit' : 'credit'; // "debited for Rs 240; BLINKIT credited" is a debit
}

const cleanName = (s) => s.replace(/\s+/g, ' ').replace(/[.\s-]+$/, '').trim();
const isAccountRef = (s) => /^(a\/?c|acct|account|your|ur|card)\b/i.test(s) || /^\d+$/.test(s) || /^(vpa|upi)$/i.test(s);

function findMerchant(text, direction) {
  const patterns = direction === 'credit'
    ? [new RegExp(`\\bfrom\\s+(?:vpa\\s+)?(${NAME})(?=\\s+(?:on|ref|via|avl|upi)\\b|[.;\\n(]|$)`, 'i'),
       new RegExp(`\\bby\\s+(?:neft|imps|upi|rtgs)?\\s*(?:from\\s+)?(${NAME})(?=\\s+(?:on|ref|via|avl)\\b|[.;\\n(]|$)`, 'i')]
    : [/upi\/[a-z0-9]+\/\d+\/([^\n/]+)/i,
       new RegExp(`;\\s*(${NAME})\\s+credited`, 'i'),
       new RegExp(`\\bat\\s+(${NAME})(?=\\s+on\\b|[.;\\n]|$)`, 'i'),
       new RegExp(`\\bto\\s*:?\\s*(?:vpa\\s+)?(${NAME})(?=\\s+(?:on|ref|refno|upi|via|avl)\\b|[.;\\n(]|$)`, 'i'),
       new RegExp(`\\bon\\s+([A-Za-z][A-Za-z0-9 &'_*-]{2,40}?)\\.(?:\\s|$)`, 'i')];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const name = cleanName(m[1]);
    if (name.length >= 2 && !isAccountRef(name) && !/^(date|\d)/i.test(name) && !parseStatementDate(name)) return name;
  }
  return null;
}

function findDate(text, tz) {
  const m = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ]?[A-Za-z]{3}[- ]?\d{2,4})\b/);
  const date = m ? parseStatementDate(m[1], tz) : null;
  // A date more than a day ahead is a mis-read (e.g. a due date), so fall back to now.
  if (!date || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return date;
}

/** Regex-only parse. Returns null when the SMS is not understood; throws SmsParseError when it is not a transaction. */
export function parseBankSmsText(raw, tz = DEFAULT_TIMEZONE) {
  const text = String(raw || '').replace(/\r/g, '').trim();
  if (!text) throw new SmsParseError('EMPTY', 'Paste the SMS text.');
  if (NOT_A_TRANSACTION.test(text)) throw new SmsParseError('NOT_TRANSACTION', 'This SMS is an OTP, reminder or request, not a completed transaction.');
  const direction = findDirection(text);
  if (PROMO.test(text) && !/\b(debited|credited|spent)\b/i.test(text)) {
    throw new SmsParseError('NOT_TRANSACTION', 'This looks like a promotional SMS.');
  }
  const amount = findAmount(text);
  if (!amount || !direction) return null;
  const last4 = text.match(/(?:a\/c|acct|account|\bac|card)(?:\s*no\.?)?\s*[:.]?\s*[x*]*\s*(\d{3,4})\b/i)?.[1] ?? null;
  const upiId = text.match(/\b([a-z0-9._-]{2,}@[a-z]{2,})\b/i)?.[1]?.toLowerCase() ?? null;
  return {
    amount,
    direction,
    merchant: findMerchant(text, direction),
    date: findDate(text, tz),
    last4,
    upiId,
  };
}

const SMS_SCHEMA = {
  type: 'object',
  properties: {
    isTransaction: { type: 'boolean', description: 'true only for a completed debit or credit' },
    amount: { type: 'number', nullable: true },
    direction: { type: 'string', enum: ['debit', 'credit'], nullable: true },
    merchant: { type: 'string', nullable: true, description: 'Payee for debits, payer for credits' },
    date: { type: 'string', nullable: true, description: 'YYYY-MM-DD' },
    last4: { type: 'string', nullable: true, description: 'Last digits of the account or card' },
  },
  required: ['isTransaction'],
};

/** Regex, then Gemini. Throws SmsParseError (code NOT_TRANSACTION / UNREADABLE / EMPTY). */
export async function parseBankSms(raw, tz = DEFAULT_TIMEZONE) {
  const parsed = parseBankSmsText(raw, tz);
  if (parsed) return { ...parsed, parser: 'regex' };
  let out;
  try {
    out = await generateJson({
      schema: SMS_SCHEMA,
      timeoutMs: 15000,
      parts: [`Read this Indian bank SMS. Dates are day-first. If it is not a completed debit or credit (OTP, reminder, offer), set isTransaction false.\n\n${String(raw).slice(0, 1000)}`],
    });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) throw new SmsParseError('UNREADABLE', 'Could not read an amount from this SMS.');
    throw err;
  }
  if (!out?.isTransaction) throw new SmsParseError('NOT_TRANSACTION', 'This SMS is not a completed transaction.');
  const amount = Number(out.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !['debit', 'credit'].includes(out.direction)) {
    throw new SmsParseError('UNREADABLE', 'Could not read an amount from this SMS.');
  }
  const date = out.date ? parseStatementDate(out.date, tz) : null;
  return {
    amount: Math.round(amount * 100) / 100,
    direction: out.direction,
    merchant: out.merchant ? cleanName(String(out.merchant)).slice(0, 80) : null,
    date: date && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000 ? date : null,
    last4: /^\d{3,4}$/.test(out.last4 || '') ? out.last4 : null,
    upiId: null,
    parser: 'gemini',
  };
}

/** Parsed SMS plus the matching saved payment method and, for debits, a category guess. */
export async function draftFromSms(userId, raw, tz = DEFAULT_TIMEZONE) {
  const sms = await parseBankSms(raw, tz);
  let paymentMethodId = null;
  if (sms.last4 || sms.upiId) {
    const methods = await PaymentMethod.find({ userId: String(userId), status: 'active' }).lean();
    const match = methods.find((m) => (sms.upiId && m.upiId === sms.upiId) || (sms.last4 && m.last4 && m.last4.endsWith(sms.last4)));
    if (match) paymentMethodId = match.id;
  }
  const draft = {
    ...sms,
    date: (sms.date || new Date()).toISOString(),
    description: sms.merchant || (sms.direction === 'credit' ? 'Money received' : 'Bank SMS payment'),
    paymentMethodId,
  };
  if (sms.direction === 'debit') {
    const [label] = await classifyMany(userId, [draft.description]);
    Object.assign(draft, { category: label.category, type: label.type, confidence: label.confidenceScore });
  }
  return draft;
}
