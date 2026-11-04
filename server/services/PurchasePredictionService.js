/**
 * Purchase prediction from association rules (Apriori, mined in ml-service).
 *
 * 1. buildBaskets: one basket per day (user's timezone) = the set of things bought that day.
 *    Items are the canonical category, plus "@merchant" for merchants seen on MIN_MERCHANT_DAYS+ days.
 *    Liability payments and Investment-type rows are skipped: they are scheduled, not purchases.
 * 2. mineRules: POST /association-rules on ml-service.
 * 3. predictPurchases: rules whose antecedent is already in the basis basket (today, else the
 *    latest day) and whose consequent is not, best confidence per consequent.
 */
import { merchantKey } from './MerchantMemoryService.js';
import { normalizeCategory } from './FamilyAggregationService.js';
import { zonedDateKey } from '../utils/userTime.js';

export const MIN_BASKETS = 14;
export const MIN_MERCHANT_DAYS = 3;
const MINING = { min_support: 0.05, min_confidence: 0.4, max_len: 3 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function buildBaskets(transactions, tz) {
  const rows = transactions
    .filter((t) => !t.liabilityId && t.classificationSource !== 'liability' && t.type !== 'Investment')
    .map((t) => {
      const key = merchantKey(t.description);
      return {
        day: zonedDateKey(new Date(t.timestamp), tz),
        category: normalizeCategory(t.category),
        merchant: key ? key.split(' ')[0] : null,
        amount: Number(t.amount) || 0,
        description: String(t.description || ''),
        at: new Date(t.timestamp).getTime(),
      };
    });

  // Merchants seen on enough distinct days, with a display label and their usual category
  const merchantDays = new Map();
  for (const r of rows) {
    if (!r.merchant || r.merchant.length < 3) continue;
    const m = merchantDays.get(r.merchant) || { days: new Set(), categories: new Map(), label: '', at: 0 };
    m.days.add(r.day);
    m.categories.set(r.category, (m.categories.get(r.category) || 0) + 1);
    if (r.at >= m.at) {
      m.at = r.at;
      m.label = r.description.trim().split(/\s+/)[0] || r.merchant;
    }
    merchantDays.set(r.merchant, m);
  }

  const items = new Map(); // item -> { label, kind, amounts, category }
  const byDay = new Map();
  for (const r of rows) {
    const basket = byDay.get(r.day) || new Set();
    const add = (item, meta) => {
      basket.add(item);
      const it = items.get(item) || { ...meta, amounts: [] };
      it.amounts.push(r.amount);
      items.set(item, it);
    };
    add(r.category, { label: r.category, kind: 'category' });
    const m = merchantDays.get(r.merchant);
    if (m && m.days.size >= MIN_MERCHANT_DAYS) {
      const usual = [...m.categories.entries()].sort((a, b) => b[1] - a[1])[0][0];
      add(`@${r.merchant}`, { label: m.label, kind: 'merchant', category: usual });
    }
    byDay.set(r.day, basket);
  }

  const days = [...byDay.keys()].sort();
  return {
    days,
    baskets: days.map((d) => [...byDay.get(d)].sort()),
    items,
  };
}

export async function mineRules(baskets, { url = process.env.ML_SERVICE_URL || 'http://localhost:5001', fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  const res = await fetchImpl(`${url}/association-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baskets, ...MINING }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ML service responded ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.rules)) throw new Error('ML service returned no rules');
  return data;
}

/** "@uber -> Transport & Travel" restates the merchant's own category; such rules say nothing. */
function isTrivial(rule, items) {
  const cats = new Set(rule.antecedent.map((a) => items.get(a)?.category).filter(Boolean));
  if (cats.has(rule.consequent)) return true;
  const consequentCategory = items.get(rule.consequent)?.category;
  return Boolean(consequentCategory && rule.antecedent.includes(consequentCategory));
}

export function predictPurchases(rules, { days, baskets, items }, { now = new Date(), tz, limit = 5 } = {}) {
  const label = (item) => items.get(item)?.label || item;
  const useful = rules.filter((r) => r.lift > 1 && !isTrivial(r, items));

  // Basis: the latest day with purchases (today when the user has bought something today)
  const today = zonedDateKey(now, tz);
  const basisDay = days[days.length - 1] || null;
  const basis = new Set(basisDay ? baskets[baskets.length - 1] : []);

  const best = new Map();
  for (const r of useful) {
    if (basis.has(r.consequent) || !r.antecedent.every((a) => basis.has(a))) continue;
    const prev = best.get(r.consequent);
    if (!prev || r.confidence > prev.confidence || (r.confidence === prev.confidence && r.lift > prev.lift)) {
      best.set(r.consequent, r);
    }
  }

  const predictions = [...best.values()]
    .sort((a, b) => b.confidence - a.confidence || b.lift - a.lift)
    .slice(0, limit)
    .map((r) => ({
      item: r.consequent,
      label: label(r.consequent),
      kind: items.get(r.consequent)?.kind || 'category',
      confidence: r.confidence,
      lift: r.lift,
      support: r.support,
      because: r.antecedent.map(label),
      typicalAmount: items.has(r.consequent) ? Math.round(median(items.get(r.consequent).amounts)) : null,
    }));

  return {
    available: true,
    basketCount: baskets.length,
    basis: { date: basisDay, isToday: basisDay === today, items: [...basis].map(label) },
    predictions,
    rules: useful.slice(0, 10).map((r) => ({
      antecedent: r.antecedent.map(label),
      consequent: label(r.consequent),
      support: r.support,
      confidence: r.confidence,
      lift: r.lift,
    })),
  };
}
