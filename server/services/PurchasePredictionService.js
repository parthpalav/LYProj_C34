/**
 * Purchase prediction from association rules (Apriori, mined in ml-service).
 *
 * 1. buildBaskets: one basket per day (user's timezone) = the set of things bought that day.
 *    Items are the canonical category, plus "@merchant" for merchants seen on MIN_MERCHANT_DAYS+ days,
 *    plus the day's weekday ("dow:Sat") so rules can fire before anything is bought today.
 *    Liability payments and Investment-type rows are skipped: they are scheduled, not purchases.
 * 2. mineRules: POST /association-rules on ml-service.
 * 3. predictPurchases: rules whose antecedent is already in the basis basket (today's purchases plus
 *    today's weekday) and whose consequent is not, best m-estimate likelihood per consequent.
 *    Slots no rule fills go to the user's most frequent items (share of purchase days).
 */
import { merchantKey } from './MerchantMemoryService.js';
import { normalizeCategory } from './FamilyAggregationService.js';
import { zonedDateKey } from '../utils/userTime.js';

export const MIN_BASKETS = 14;
export const MIN_MERCHANT_DAYS = 3;
const MINING = { min_support: 0.05, min_confidence: 0.4, max_len: 3 };
// m-estimate pseudo-count: shrinks a rule's confidence toward the consequent's base rate,
// because confidence measured on training days overstates how often the rule comes true.
const M_ESTIMATE = 2;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayName = (dayKey) => WEEKDAYS[new Date(`${dayKey}T00:00:00Z`).getUTCDay()];
const weekdayItem = (dayKey) => `dow:${weekdayName(dayKey).slice(0, 3)}`;
const isWeekdayItem = (item) => item.startsWith('dow:');
const round4 = (x) => Math.round(x * 10000) / 10000;

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

  // Weekday context item: lets weekly habits ("Saturdays -> Groceries") predict before any purchase today
  for (const [day, basket] of byDay) {
    const w = weekdayItem(day);
    basket.add(w);
    if (!items.has(w)) items.set(w, { label: `${weekdayName(day)}s`, kind: 'weekday', amounts: [] });
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

function ruleReason(rule, label) {
  const bought = rule.antecedent.filter((a) => !isWeekdayItem(a)).map(label);
  const weekday = rule.antecedent.find(isWeekdayItem);
  if (!bought.length) return `you often buy it on ${label(weekday)}`;
  return `because you bought ${bought.join(' + ')}${weekday ? ` on a ${label(weekday).slice(0, -1)}` : ''}`;
}

export function predictPurchases(rules, { days, baskets, items }, { now = new Date(), tz, limit = 5 } = {}) {
  const label = (item) => items.get(item)?.label || item;
  const n = baskets.length;
  const useful = rules.filter((r) => r.lift > 1 && !isWeekdayItem(r.consequent) && !isTrivial(r, items));

  // Basis: today's purchases plus today's weekday. Rules are same-day co-occurrences,
  // so an earlier day's basket says nothing about what comes next today.
  const today = zonedDateKey(now, tz);
  const basis = new Set(days[days.length - 1] === today ? baskets[baskets.length - 1] : []);
  basis.add(weekdayItem(today));

  const best = new Map(); // item -> { likelihood, rule }
  for (const r of useful) {
    if (basis.has(r.consequent) || !r.antecedent.every((a) => basis.has(a))) continue;
    const nXY = r.support * n;
    const nX = nXY / r.confidence;
    const pY = r.confidence / r.lift;
    const likelihood = (nXY + M_ESTIMATE * pY) / (nX + M_ESTIMATE);
    const prev = best.get(r.consequent);
    if (!prev || likelihood > prev.likelihood || (likelihood === prev.likelihood && r.lift > prev.rule.lift)) {
      best.set(r.consequent, { likelihood, rule: r });
    }
  }

  // Backoff for items no rule predicts: how often the user buys them at all (share of purchase days)
  const dayShare = new Map();
  for (const b of baskets) for (const it of b) if (!isWeekdayItem(it)) dayShare.set(it, (dayShare.get(it) || 0) + 1 / n);
  for (const [it, share] of dayShare) {
    if (!basis.has(it) && !best.has(it)) best.set(it, { likelihood: share, rule: null });
  }

  const predictions = [...best.entries()]
    .sort(([, a], [, b]) => b.likelihood - a.likelihood || (b.rule?.lift ?? 0) - (a.rule?.lift ?? 0))
    .slice(0, limit)
    .map(([item, { likelihood, rule }]) => ({
      item,
      label: label(item),
      kind: items.get(item)?.kind || 'category',
      source: rule ? 'rule' : 'frequency',
      confidence: round4(likelihood),
      lift: rule ? rule.lift : null,
      support: rule ? rule.support : round4(dayShare.get(item)),
      because: rule ? rule.antecedent.map(label) : [],
      reason: rule ? ruleReason(rule, label) : `bought on ${Math.round(likelihood * 100)}% of your purchase days`,
      typicalAmount: items.get(item)?.amounts.length ? Math.round(median(items.get(item).amounts)) : null,
    }));

  return {
    available: true,
    basketCount: n,
    basis: {
      date: today,
      weekday: weekdayName(today),
      items: [...basis].filter((it) => !isWeekdayItem(it)).map(label),
    },
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
