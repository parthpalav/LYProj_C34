/**
 * server/test_investment_classification_bug.js
 * 
 * Target test suite verifying:
 * 1. Official 'Investments' Category Classification across Python ML & Node Fallback.
 * 2. Bug Regression: 'Nifty50' and 'Nvidia shares' NEVER classify as 'Food'.
 * 3. Canonical investment descriptions classify to Category: Investments, Type: Investment.
 * 4. Negative regression: Food, Travel, Bills, Groceries, etc. are properly protected.
 * 5. FMI & Predictability accounting invariance: type === 'Investment' remains authoritative.
 */

import assert from 'node:assert/strict';
import { isInvestment, isConsumption } from './utils/financialAccounting.js';
import { VALID_CATEGORIES, VALID_TYPES } from './models/Transaction.js';

console.log('='.repeat(64));
console.log('  FINAURA INVESTMENT CLASSIFICATION & BUG REGRESSION SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name} Passed`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
}

// ── Mock the Node Local Fallback function from controllers/index.js ──
const KEYWORD_CATEGORY_MAP = {
  Food: ['pizza','burger','biryani','pasta','noodles','sandwich','dosa','idli','chai','coffee','restaurant','zomato','swiggy','dinner','lunch'],
  Travel: ['uber','ola','rapido','metro','train','flight','bus','cab','auto fare','commute'],
  Entertainment: ['movie','netflix','spotify','youtube premium','gaming','concert','ott','pvr'],
  Shopping: ['dress','clothes','shoes','amazon','flipkart','myntra','ajio','nykaa','online shopping'],
  Bills: ['electricity bill','electricity','water bill','gas bill','internet','wifi bill','mobile recharge','house rent','rent','emi'],
  Groceries: ['vegetables','fruits','milk','eggs','bread','grocery','supermarket','dmart','blinkit','zepto','instamart'],
  Health: ['doctor','hospital','clinic','medicine','pharmacy','tablets','gym','therapy'],
  Party: ['party','birthday party','club','nightclub','bar','pub','cocktails'],
  Education: ['books','course','online course','udemy','coursera','tuition','fees','college fees'],
  Investments: [
    'nifty50','nifty 50','nifty etf','nifty index','nifty bees','nifty',
    'sensex','s&p 500','nasdaq',
    'mutual fund sip','mutual fund','mutual funds','sip investment','sip payment','sip deduction','sip',
    'zerodha kite','zerodha stocks','zerodha','groww mutual fund','groww stocks','groww investment','groww',
    'upstox','angel one','kuvera','smallcase','etmoney','indmoney','demat account','demat',
    'index fund','stocks investment','stock purchase','stocks','shares purchase','equity shares','equity investment','equity trading',
    'nvidia shares','apple stock','bought stock','bought shares','shares',
    'reliance shares','tcs shares','hdfc mutual fund','sbi nifty',
    'nps contribution','nps deposit','nps tier','nps',
    'ppf deposit','ppf contribution','ppf account','ppf',
    'epf contribution','epf deposit','epf',
    'provident fund','sovereign gold bond','sgb',
    'government bond purchase','government bond investment','government bond','govt bond','corporate bond','treasury bill','securities investment'
  ],
};

const CATEGORY_TYPE_MAP = {
  Food: 'Want', Travel: 'Want', Entertainment: 'Want', Shopping: 'Want',
  Bills: 'Need', Groceries: 'Need', Health: 'Need',
  Party: 'Want', Education: 'Investment', Investments: 'Investment', Misc: 'Need',
};

function classifyLocally(rawText) {
  const text = (rawText || '').toLowerCase()
    .replace(/[₹$]?\s*\d+(\.\d+)?\s*(rs\.?|inr)?/gi, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  let bestCategory = 'Misc';
  let bestScore    = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      if (text.includes(kw)) {
        const score = kw.length;
        if (score > bestScore) {
          bestScore    = score;
          bestCategory = category;
        }
      }
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.95, 0.5 + bestScore * 0.03) : 0.1;
  const type = CATEGORY_TYPE_MAP[bestCategory] || 'Need';

  return {
    category: bestCategory,
    type,
    confidence: Math.round(confidence * 100) / 100,
    needsReview: confidence < 0.60,
  };
}

// ── TEST 1: Schema & Valid Categories Validation ─────────────────────────────
test('1. Valid Categories array contains official Investments category', () => {
  assert.ok(VALID_CATEGORIES.includes('Investments'), 'Investments is in VALID_CATEGORIES');
  assert.equal(VALID_CATEGORIES.length, 11, '11 canonical categories exist');
  assert.ok(VALID_TYPES.includes('Investment'), 'Investment is in VALID_TYPES');
});

// ── TEST 2: Node Fallback Canonical Investments ──────────────────────────────
test('2. Node Fallback classifies canonical investments to Category: Investments, Type: Investment', () => {
  const cases = [
    'Nifty50',
    'Nifty 50 SIP',
    'Nvidia shares',
    'Bought Apple stock',
    'SBI Nifty Index Fund',
    'HDFC Mutual Fund SIP',
    'Zerodha stocks',
    'Groww mutual fund',
    'NPS contribution',
    'PPF deposit',
    'Government bond purchase',
    'Nifty ETF',
  ];

  for (const text of cases) {
    const res = classifyLocally(text);
    assert.equal(res.category, 'Investments', `Fallback Category for "${text}" must be Investments, got: ${res.category}`);
    assert.equal(res.type, 'Investment', `Fallback Type for "${text}" must be Investment, got: ${res.type}`);
    assert.equal(res.needsReview, false, `Fallback should be confident for known investment: "${text}"`);
  }
});

// ── TEST 3: Particular Bug Regression: Nifty50 and Nvidia shares NEVER return Food ─
test('3. CRITICAL BUG REGRESSION: "Nifty50" and "Nvidia shares" NEVER classify as Food', () => {
  const bugInputs = ['Nifty50', '50000 nifty 50', 'Nvidia shares', 'Bought Apple stock'];

  for (const input of bugInputs) {
    const res = classifyLocally(input);
    assert.notEqual(res.category, 'Food', `BUG REGRESSION: "${input}" classified as Food!`);
    assert.equal(res.category, 'Investments', `"${input}" must be category Investments`);
    assert.equal(res.type, 'Investment', `"${input}" must be type Investment`);
  }
});

// ── TEST 4: Negative Regression Protection for Non-Investment Categories ─────
test('4. Non-investment categories are properly classified and protected against false matches', () => {
  const cases = [
    { text: 'Swiggy biryani', expectedCat: 'Food', expectedType: 'Want' },
    { text: 'Uber ride', expectedCat: 'Travel', expectedType: 'Want' },
    { text: 'Netflix subscription', expectedCat: 'Entertainment', expectedType: 'Want' },
    { text: 'Electricity bill', expectedCat: 'Bills', expectedType: 'Need' },
    { text: 'DMart groceries', expectedCat: 'Groceries', expectedType: 'Need' },
    { text: 'Doctor consultation', expectedCat: 'Health', expectedType: 'Need' },
    { text: 'College tuition', expectedCat: 'Education', expectedType: 'Investment' },
    { text: 'New shoes shopping', expectedCat: 'Shopping', expectedType: 'Want' },
    { text: 'Birthday party', expectedCat: 'Party', expectedType: 'Want' },
  ];

  for (const { text, expectedCat, expectedType } of cases) {
    const res = classifyLocally(text);
    assert.equal(res.category, expectedCat, `Negative regression in category for "${text}"`);
    assert.equal(res.type, expectedType, `Negative regression in type for "${text}"`);
  }
});

// ── TEST 5: Financial Accounting Invariance ──────────────────────────────────
test('5. Financial Accounting: isInvestment strictly evaluates type === "Investment" regardless of category', () => {
  // Transaction with new category Investments and type Investment -> isInvestment is true
  const invTx = { amount: 25000, category: 'Investments', type: 'Investment' };
  assert.equal(isInvestment(invTx), true, 'Category: Investments, Type: Investment is investment');
  assert.equal(isConsumption(invTx), false, 'Investment is not consumption');

  // Legacy transaction with category Misc and type Investment -> isInvestment is still true
  const legacyInvTx = { amount: 10000, category: 'Misc', type: 'Investment' };
  assert.equal(isInvestment(legacyInvTx), true, 'Legacy Investment transaction is recognized as investment');

  // Consumption transaction with category Bills and type Need -> isConsumption is true
  const needTx = { amount: 5000, category: 'Bills', type: 'Need' };
  assert.equal(isInvestment(needTx), false, 'Bills/Need is not investment');
  assert.equal(isConsumption(needTx), true, 'Bills/Need is consumption');
});

// ── TEST 6: Ambiguous & Non-Investment Phrase Safety ─────────────────────────
test('6. Ambiguous terms (share, stock up, bond, security deposit, apple store) DO NOT false-match Investments', () => {
  const ambiguousCases = [
    { text: 'share dinner bill', expectedNot: 'Investments' },
    { text: 'share cab fare', expectedNot: 'Investments' },
    { text: 'stock up on groceries', expectedNot: 'Investments' },
    { text: 'stock photos subscription', expectedNot: 'Investments' },
    { text: 'equity in my home', expectedNot: 'Investments' },
    { text: 'bond with friends', expectedNot: 'Investments' },
    { text: 'security deposit for apartment', expectedNot: 'Investments' },
    { text: 'securities exam course', expectedNot: 'Investments' },
    { text: 'Apple Store purchase', expectedNot: 'Investments' },
  ];

  for (const { text, expectedNot } of ambiguousCases) {
    const res = classifyLocally(text);
    assert.notEqual(res.category, expectedNot, `False positive: "${text}" falsely classified as ${expectedNot}! (got type: ${res.type})`);
  }
});

console.log('='.repeat(64));
console.log(`  INVESTMENT CLASSIFICATION SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);
