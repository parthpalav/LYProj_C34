// Automated transaction input: bank statement import, bank SMS parsing/capture, receipt scan.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import CapturedTransaction from '../models/CapturedTransaction.js';
import { getUserTimezone } from '../services/userTimezone.js';
import { resolvePaymentMethodId, PaymentMethodError } from '../services/PaymentMethodService.js';
import { rememberMerchant } from '../services/MerchantMemoryService.js';
import {
  ImportError, buildPreview, validateCommitRows, commitRows, deleteBatch, classifyMany, parseStatementDate,
} from '../services/StatementImportService.js';
import { draftFromSms, SmsParseError } from '../services/SmsParser.js';
import { generateJson, GeminiUnavailableError } from '../services/GeminiJson.js';

const MAX_FILE_BYTES = 6 * 1024 * 1024;

function userFilter(userId) {
  const conditions = [{ id: userId }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  return { $or: conditions };
}

function sendError(res, err, next) {
  if (err instanceof ImportError) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  if (err instanceof SmsParseError) return res.status(422).json({ success: false, code: err.code, error: err.message });
  if (err instanceof PaymentMethodError) return res.status(err.status).json({ success: false, error: err.message });
  return next(err);
}

function decodeFile(data) {
  if (typeof data !== 'string' || !data) throw new ImportError(400, 'NO_FILE', 'Attach a file.');
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buffer.length) throw new ImportError(400, 'NO_FILE', 'The file is empty.');
  if (buffer.length > MAX_FILE_BYTES) throw new ImportError(413, 'FILE_TOO_LARGE', 'The file is larger than 6 MB.');
  return buffer;
}

// ── Statement import ─────────────────────────────────────────

// POST /api/import/statement/preview — parse + classify, nothing written
export async function previewStatement(req, res, next) {
  try {
    const { fileName, mimeType, data, password } = req.body || {};
    if (password !== undefined && (typeof password !== 'string' || password.length > 100)) {
      throw new ImportError(400, 'BAD_PASSWORD', 'Invalid password.');
    }
    const buffer = decodeFile(data);
    const tz = await getUserTimezone(req.user.id);
    const preview = await buildPreview(req.user.id, {
      fileName: typeof fileName === 'string' ? fileName.slice(0, 200) : '',
      mimeType: typeof mimeType === 'string' ? mimeType.slice(0, 100) : '',
      buffer,
      password,
    }, tz);
    res.json(preview);
  } catch (err) { sendError(res, err, next); }
}

// POST /api/import/statement/commit — history only, balances untouched (except the opt-in closing balance)
export async function commitStatement(req, res, next) {
  try {
    const userId = req.user.id;
    const { rows, paymentMethodId: rawMethod, setClosingBalance, closingBalance } = req.body || {};
    const clean = validateCommitRows(rows);
    const paymentMethodId = await resolvePaymentMethodId(userId, rawMethod);
    const result = await commitRows(userId, paymentMethodId, clean);

    // User corrections teach merchant memory, same as editing a single transaction.
    await Promise.all(clean.filter((r) => r.direction === 'debit' && r.userEdited)
      .map((r) => rememberMerchant(userId, r.description, r.category, r.type).catch(() => null)));

    if (setClosingBalance === true && paymentMethodId === null) {
      const balance = Number(closingBalance);
      if (!Number.isFinite(balance) || Math.abs(balance) > 1e12) throw new ImportError(400, 'BAD_BALANCE', 'Invalid closing balance.');
      await User.findOneAndUpdate(userFilter(userId), { $set: { currentBalance: Math.round(balance * 100) / 100 } });
      result.balanceSetTo = Math.round(balance * 100) / 100;
    }
    res.status(201).json(result);
  } catch (err) { sendError(res, err, next); }
}

// DELETE /api/import/:batchId — undo one import
export async function undoImport(req, res, next) {
  try {
    const { batchId } = req.params;
    if (!/^[a-z0-9]{8,40}$/.test(batchId)) return res.status(400).json({ success: false, error: 'Invalid import id' });
    const result = await deleteBatch(req.user.id, batchId);
    if (!result.deletedTransactions && !result.deletedIncome) return res.status(404).json({ success: false, error: 'Import not found' });
    res.json(result);
  } catch (err) { next(err); }
}

// ── Bank SMS ─────────────────────────────────────────────────

const smsText = (body) => {
  const text = typeof body?.text === 'string' ? body.text : typeof body?.message === 'string' ? body.message : '';
  if (!text.trim()) throw new SmsParseError('EMPTY', 'Paste the SMS text.');
  if (text.length > 1000) throw new SmsParseError('TOO_LONG', 'The SMS is longer than 1000 characters.');
  return text;
};

// POST /api/sms/parse — pasted SMS to a draft entry (nothing written)
export async function parseSms(req, res, next) {
  try {
    const text = smsText(req.body);
    const tz = await getUserTimezone(req.user.id);
    res.json(await draftFromSms(req.user.id, text, tz));
  } catch (err) { sendError(res, err, next); }
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// GET /api/sms/token — whether auto-capture is set up
export async function getSmsToken(req, res, next) {
  try {
    const user = await User.findOne(userFilter(req.user.id), { smsIngestTokenCreatedAt: 1 }).lean();
    res.json({ enabled: !!user?.smsIngestTokenCreatedAt, createdAt: user?.smsIngestTokenCreatedAt ?? null });
  } catch (err) { next(err); }
}

// POST /api/sms/token — new personal token, shown once; replaces any old one
export async function createSmsToken(req, res, next) {
  try {
    const token = `fsms_${crypto.randomBytes(32).toString('base64url')}`;
    const createdAt = new Date();
    await User.findOneAndUpdate(userFilter(req.user.id), { $set: { smsIngestTokenHash: hashToken(token), smsIngestTokenCreatedAt: createdAt } });
    res.status(201).json({ token, createdAt });
  } catch (err) { next(err); }
}

// DELETE /api/sms/token
export async function revokeSmsToken(req, res, next) {
  try {
    await User.findOneAndUpdate(userFilter(req.user.id), { $set: { smsIngestTokenHash: null, smsIngestTokenCreatedAt: null } });
    res.json({ enabled: false });
  } catch (err) { next(err); }
}

// POST /api/sms/ingest — called by the iOS Shortcut with the personal token (no JWT).
// Non-transaction SMS return 200 with `ignored` so the Shortcut does not show an error.
export async function ingestSms(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!/^fsms_[A-Za-z0-9_-]{40,}$/.test(token)) return res.status(401).json({ success: false, error: 'Invalid capture token' });
    const user = await User.findOne({ smsIngestTokenHash: hashToken(token) }, { id: 1 }).lean();
    if (!user) return res.status(401).json({ success: false, error: 'Invalid capture token' });
    const userId = user.id || user._id.toString();

    let text;
    try { text = smsText(req.body); } catch (err) { return res.status(400).json({ success: false, error: err.message }); }
    const textHash = crypto.createHash('sha256').update(`${userId}|${text.replace(/\s+/g, ' ').trim()}`).digest('hex');
    if (await CapturedTransaction.exists({ userId, textHash })) return res.json({ duplicate: true });

    const tz = await getUserTimezone(userId);
    let draft;
    try {
      draft = await draftFromSms(userId, text, tz);
    } catch (err) {
      if (err instanceof SmsParseError) return res.json({ ignored: err.code });
      throw err;
    }
    try {
      const captured = await CapturedTransaction.create({
        id: `cap-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
        userId,
        textHash,
        amount: draft.amount,
        direction: draft.direction,
        merchant: draft.merchant,
        description: draft.description,
        date: new Date(draft.date),
        last4: draft.last4,
        upiId: draft.upiId,
        paymentMethodId: draft.paymentMethodId,
        category: draft.category ?? null,
        type: draft.type ?? null,
        parser: draft.parser,
      });
      res.status(201).json({ captured: { id: captured.id, amount: captured.amount, direction: captured.direction, description: captured.description } });
    } catch (err) {
      if (err?.code === 11000) return res.json({ duplicate: true }); // same SMS sent twice at once
      throw err;
    }
  } catch (err) { next(err); }
}

// GET /api/captured — pending SMS captures, newest first
export async function listCaptured(req, res, next) {
  try {
    const items = await CapturedTransaction.find({ userId: String(req.user.id), status: 'pending' }, { _id: 0, textHash: 0, userId: 0 })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json(items);
  } catch (err) { next(err); }
}

// POST /api/captured/:id/dismiss
export async function dismissCaptured(req, res, next) {
  try {
    const updated = await CapturedTransaction.findOneAndUpdate(
      { id: String(req.params.id), userId: String(req.user.id), status: 'pending' },
      { $set: { status: 'dismissed' } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ success: false, error: 'Captured item not found' });
    res.json({ id: updated.id, status: updated.status });
  } catch (err) { next(err); }
}

/** Marks a pending capture confirmed after the user saved it as a transaction or income. */
export async function confirmCaptured(userId, capturedId) {
  if (typeof capturedId !== 'string' || !capturedId) return;
  await CapturedTransaction.updateOne({ id: capturedId, userId: String(userId), status: 'pending' }, { $set: { status: 'confirmed' } });
}

// ── Receipt scan ─────────────────────────────────────────────

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    isReceipt: { type: 'boolean', description: 'true if this is a bill, receipt or invoice' },
    amount: { type: 'number', nullable: true, description: 'Grand total paid, including taxes' },
    merchant: { type: 'string', nullable: true },
    date: { type: 'string', nullable: true, description: 'YYYY-MM-DD' },
    items: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Up to 5 main items' },
  },
  required: ['isReceipt'],
};

// POST /api/receipt/scan — photo of a bill to a draft entry (nothing written)
export async function scanReceipt(req, res, next) {
  try {
    const { data, mimeType } = req.body || {};
    const type = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mimeType) ? mimeType : 'image/jpeg';
    const buffer = decodeFile(data);
    let out;
    try {
      out = await generateJson({
        schema: RECEIPT_SCHEMA,
        timeoutMs: 30000,
        parts: [
          { inlineData: { data: buffer.toString('base64'), mimeType: type } },
          'Read this receipt (likely Indian, amounts in INR). Return the grand total actually paid, the shop or merchant name, the bill date (day-first in India) and up to 5 main items.',
        ],
      });
    } catch (err) {
      if (err instanceof GeminiUnavailableError) {
        return res.status(503).json({ success: false, code: 'RECEIPT_UNAVAILABLE', error: 'Receipt scanning is unavailable right now. Enter the amount manually.' });
      }
      throw err;
    }
    const amount = Number(out?.amount);
    if (!out?.isReceipt || !Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({ success: false, code: 'NOT_A_RECEIPT', error: 'Could not find a total on this photo.' });
    }
    const merchant = typeof out.merchant === 'string' ? out.merchant.trim().slice(0, 80) : '';
    const items = Array.isArray(out.items) ? out.items.filter((i) => typeof i === 'string').slice(0, 5) : [];
    const description = (merchant || items.slice(0, 2).join(', ') || 'Receipt').slice(0, 120);
    const date = out.date ? parseStatementDate(out.date, await getUserTimezone(req.user.id)) : null;
    const [label] = await classifyMany(req.user.id, [[merchant, ...items].filter(Boolean).join(' ') || description]);
    res.json({
      amount: Math.round(amount * 100) / 100,
      merchant: merchant || null,
      items,
      description,
      date: date && date.getTime() <= Date.now() + 86400000 ? date.toISOString() : null,
      category: label.category,
      type: label.type,
      confidence: label.confidenceScore,
    });
  } catch (err) { sendError(res, err, next); }
}
