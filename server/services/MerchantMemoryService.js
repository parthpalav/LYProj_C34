import MerchantPreference from '../models/MerchantPreference.js';
import { CANONICAL_V3_CATEGORIES, VALID_TYPES } from '../models/Transaction.js';

// Mirrors ml-service/classifier/normalize.py so typed text and UPI / POS / NEFT strings
// for the same merchant map to one key.
const BANK_STRING = /^\s*(upi|neft|imps|rtgs|pos|ach|nach|bil|ecom|mmt|int)\b|\b(txn|pos)\b|\d{6,}|@[a-z]/i;
const RAIL_TOKENS = new Set([
  'upi', 'dr', 'cr', 'neft', 'imps', 'rtgs', 'pos', 'ach', 'nach', 'bil', 'onl', 'ecom',
  'txn', 'trf', 'ref', 'mmt', 'int', 'inb', 'mb', 'ib', 'vps', 'vsi', 'pur', 'purchase',
  'debit', 'credit', 'card', 'p2a', 'p2m', 'collect', 'pay', 'sent', 'received', 'upiintent',
  'nwd', 'atw', 'wdl', 'pcd', 'yesb', 'ybs', 'netbank', 'autopay',
  'okaxis', 'oksbi', 'okicici', 'okhdfcbank', 'ybl', 'ibl', 'axl', 'apl', 'paytm',
  'hdfcbank', 'icici', 'sbi', 'axis', 'kotak', 'yesbank', 'idfcbank', 'barodampay', 'fbl',
  'axisbank', 'icicibank', 'sbin', 'utib', 'hdfc', 'kkbk', 'punb', 'jupiteraxis', 'freecharge'
]);
const KEY_STOPWORDS = new Set([
  'paid', 'pay', 'payment', 'to', 'for', 'at', 'from', 'via', 'on', 'in', 'the', 'a', 'an',
  'and', 'of', 'my', 'with', 'order', 'ordered', 'bill', 'bought', 'purchase', 'spent',
  'rs', 'inr', 'transfer', 'sent', 'online', 'monthly', 'weekly', 'today', 'yesterday'
]);

// Reference numbers, card masks and terminal ids; short brand tokens like 1mg, box8, 5paisa survive.
const isRef = (t) => {
  const digits = (t.match(/\d/g) || []).length;
  return digits > 0 && (t.length > 6 || digits > 2 || digits === t.length);
};

export function merchantKey(raw) {
  let text = String(raw || '').toLowerCase().replace(/['’`]/g, '');
  if (BANK_STRING.test(text)) {
    text = text
      .replace(/\b[a-z]{4}0[a-z0-9]{6}\b/g, ' ')
      .replace(/([a-z0-9._-]+)@[a-z]+/g, (_, local) => local.replace(/\d+/g, ' '))
      .split(/[\s/|\-_*:,.#]+/)
      .filter((t) => t && !isRef(t) && !RAIL_TOKENS.has(t))
      .filter((t, k, all) => all.indexOf(t) === k) // HDFC repeats the payee as name and VPA
      .join(' ');
  }
  text = text
    .replace(/(₹|rs\.?|inr)\s*\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s*(₹|rs\.?|inr|\/-)/g, ' ')
    .replace(/\b\d+(\.\d+)?\b/g, ' ')
    .replace(/[^a-z0-9\s+&]/g, ' ');
  return text
    .split(/\s+/)
    .filter((t) => t.length > 1 && !KEY_STOPWORDS.has(t))
    .slice(0, 3)
    .join(' ');
}

export async function recallMerchant(userId, description) {
  const key = merchantKey(description);
  if (!userId || !key) return null;
  const tokens = key.split(' ');
  const first = tokens[0].replace(/\+/g, '\\+');
  const prefs = await MerchantPreference.find({
    userId: String(userId),
    merchantKey: { $regex: `^${first}( |$)` }
  }).lean();
  const exact = prefs.find((p) => p.merchantKey === key);
  if (exact) return exact;

  // Typed text mixes merchant and free words ("zomato dinner" vs "zomato lunch"), so fall back
  // to the pref sharing the longest leading run of tokens; a tie with different labels is ambiguous.
  // shortcut: a shared first word alone borrows the label ("uber eats" gets an "uber ride" label
  // until corrected once); upgrade to a merchant dictionary if real use shows frequent misses.
  let best = null;
  let bestShared = 0;
  let ambiguous = false;
  for (const pref of prefs) {
    const prefTokens = pref.merchantKey.split(' ');
    let shared = 0;
    while (shared < prefTokens.length && prefTokens[shared] === tokens[shared]) shared++;
    if (shared > bestShared) {
      best = pref;
      bestShared = shared;
      ambiguous = false;
    } else if (shared === bestShared && (pref.category !== best.category || pref.type !== best.type)) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

export async function rememberMerchant(userId, description, category, type) {
  const key = merchantKey(description);
  if (!userId || !key || !CANONICAL_V3_CATEGORIES.includes(category) || !VALID_TYPES.includes(type)) return;
  await MerchantPreference.updateOne(
    { userId: String(userId), merchantKey: key },
    { $set: { category, type }, $inc: { hits: 1 } },
    { upsert: true }
  );
}

// Shape a remembered label like an ML /classify response so callers can use it as-is.
export function memoryResult(pref) {
  return {
    category: pref.category,
    type: pref.type,
    confidence: 1,
    confidenceScore: 1,
    categoryConfidence: 1,
    typeConfidence: 1,
    all_probs: { [pref.category]: 1 },
    classificationSource: 'user_memory',
    categorySource: 'user_memory',
    typeSource: 'user_memory',
    needsReview: false,
    flagged_for_review: false
  };
}
