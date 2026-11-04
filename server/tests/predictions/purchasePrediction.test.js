// Pure checks for PurchasePredictionService (ml-service mocked). Run: node server/tests/predictions/purchasePrediction.test.js
import assert from 'node:assert/strict';
import { buildBaskets, mineRules, predictPurchases } from '../../services/PurchasePredictionService.js';

const tz = 'UTC';
const tx = (day, description, category, amount, extra = {}) => ({ description, category, amount, type: 'Want', timestamp: `2026-07-${day}T12:00:00Z`, ...extra });
const txs = [
  tx('01', 'Uber to office', 'Transport & Travel', 200),
  tx('01', 'Swiggy biryani', 'Food & Dining', 400),
  tx('02', 'Uber home', 'Transport & Travel', 180),
  tx('02', 'Swiggy pizza', 'Food & Dining', 600),
  tx('03', 'Uber ride', 'Transport & Travel', 220),
  tx('03', 'BigBasket groceries', 'Groceries', 1500),
  tx('04', 'PVR movie', 'Entertainment', 500), // PVR seen on 1 day only: no merchant item
  tx('04', 'Home loan EMI', 'Debt & Loan Payments', 20000, { liabilityId: 'L1' }),
  tx('04', 'SIP Axis fund', 'Investments', 5000, { type: 'Investment' }),
  tx('04', 'Rent autopay', 'Housing', 30000, { classificationSource: 'liability' }),
];

const history = buildBaskets(txs, tz);
assert.deepEqual(history.days, ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
assert.deepEqual(history.baskets[0], ['@uber', 'Food & Dining', 'Transport & Travel', 'dow:Wed'], 'Uber (3 days) is a merchant item, Swiggy (2 days) is not; weekday item added');
assert.deepEqual(history.baskets[3], ['Entertainment', 'dow:Sat'], 'liability, autopay and investment rows skipped; PVR below merchant threshold');
assert.deepEqual(history.items.get('dow:Sat'), { label: 'Saturdays', kind: 'weekday', amounts: [] });
assert.equal(history.items.has('@swiggy'), false, 'Swiggy seen on 2 days < 3');
assert.equal(history.items.get('@uber').label, 'Uber');
assert.equal(history.items.get('@uber').category, 'Transport & Travel');
assert.deepEqual(history.items.get('Food & Dining').amounts, [400, 600]);

// Rules as ml-service returns them
const rules = [
  { antecedent: ['@uber'], consequent: 'Transport & Travel', support: 0.75, confidence: 1, lift: 1.33 }, // trivial: merchant's own category
  { antecedent: ['Transport & Travel'], consequent: 'Food & Dining', support: 0.5, confidence: 0.67, lift: 1.33 },
  { antecedent: ['@uber'], consequent: 'Food & Dining', support: 0.5, confidence: 0.67, lift: 1.2 },
  { antecedent: ['Entertainment'], consequent: 'Food & Dining', support: 0.3, confidence: 0.9, lift: 1.5 },
  { antecedent: ['Entertainment'], consequent: 'Groceries', support: 0.2, confidence: 0.5, lift: 0.8 }, // lift <= 1 dropped
  { antecedent: ['Entertainment', 'Groceries'], consequent: 'Health', support: 0.1, confidence: 0.95, lift: 3 }, // antecedent not all in basis
];
const out = predictPurchases(rules, history, { now: new Date('2026-07-04T20:00:00Z'), tz });
assert.deepEqual(out.basis, { date: '2026-07-04', weekday: 'Saturday', items: ['Entertainment'] });
// Entertainment -> Food: m-estimate (1.2 + 2*0.6) / (1.3333 + 2) = 0.72, below the raw 0.9.
// Slots no rule fills are backed off to share of purchase days: Uber and Transport 3/4, Groceries 1/4.
assert.deepEqual(out.predictions.map((p) => p.item), ['@uber', 'Transport & Travel', 'Food & Dining', 'Groceries']);
const food = out.predictions.find((p) => p.item === 'Food & Dining');
assert.equal(food.source, 'rule');
assert.equal(food.confidence, 0.72);
assert.deepEqual(food.because, ['Entertainment']);
assert.equal(food.reason, 'because you bought Entertainment');
assert.equal(food.typicalAmount, 500); // median of 400, 600
const uber = out.predictions[0];
assert.deepEqual([uber.source, uber.confidence, uber.lift, uber.because, uber.reason], ['frequency', 0.75, null, [], 'bought on 75% of your purchase days']);
assert.ok(!out.predictions.some((p) => p.item === 'Health'), 'rule needs Groceries, not in basis');
assert.ok(out.rules.every((r) => r.lift > 1));
assert.ok(!out.rules.some((r) => r.antecedent[0] === 'Uber' && r.consequent === 'Transport & Travel'), 'trivial rule filtered');

// Weekday rules fire before anything is bought today; an earlier day's basket is not used
const weekdayRules = [
  { antecedent: ['dow:Thu'], consequent: 'Groceries', support: 0.25, confidence: 1, lift: 4 },
  { antecedent: ['Entertainment'], consequent: 'Food & Dining', support: 0.3, confidence: 0.9, lift: 1.5 },
  { antecedent: ['Groceries'], consequent: 'dow:Thu', support: 0.25, confidence: 1, lift: 4 }, // weekday consequent dropped
];
const cold = predictPurchases(weekdayRules, history, { now: new Date('2026-07-09T08:00:00Z'), tz });
assert.deepEqual(cold.basis, { date: '2026-07-09', weekday: 'Thursday', items: [] });
const groceries = cold.predictions.find((p) => p.item === 'Groceries');
assert.equal(groceries.source, 'rule');
assert.equal(groceries.confidence, 0.5); // (1 + 2*0.25) / (1 + 2)
assert.equal(groceries.reason, 'you often buy it on Thursdays');
assert.equal(cold.predictions.find((p) => p.item === 'Food & Dining').source, 'frequency', 'Entertainment rule needs today\'s basket');
assert.ok(!cold.predictions.some((p) => p.item.startsWith('dow:')));
assert.ok(!cold.rules.some((r) => r.consequent === 'Thursdays'));

// Rule mixing a purchase and the weekday
const mixed = predictPurchases([{ antecedent: ['Entertainment', 'dow:Sat'], consequent: 'Groceries', support: 0.25, confidence: 1, lift: 4 }], history, { now: new Date('2026-07-04T20:00:00Z'), tz });
assert.equal(mixed.predictions.find((p) => p.item === 'Groceries').reason, 'because you bought Entertainment on a Saturday');

// mineRules posts baskets and the mining thresholds
let sent;
const fake = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, json: async () => ({ rules: [] }) }; };
await mineRules([['a', 'b']], { url: 'http://ml', fetchImpl: fake });
assert.equal(sent.url, 'http://ml/association-rules');
assert.deepEqual(sent.body.baskets, [['a', 'b']]);
assert.equal(sent.body.min_support, 0.05);
await assert.rejects(mineRules([['a']], { url: 'http://ml', fetchImpl: async () => ({ ok: false, status: 500 }) }));

console.log('purchase prediction: all checks passed');
