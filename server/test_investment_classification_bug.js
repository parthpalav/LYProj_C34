/**
 * server/test_investment_classification_bug.js
 * 
 * Validates FINAURA V3 Category Taxonomy (14 Categories) + Fallback & Accounting Invariance
 */

import assert from 'node:assert/strict';
import { VALID_CATEGORIES, VALID_TYPES } from './models/Transaction.js';
import { isInvestment, isConsumption } from './utils/financialAccounting.js';

console.log('='.repeat(64));
console.log('  FINAURA V3 CATEGORY & INVESTMENT CLASSIFICATION SUITE');
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
  'Food & Dining': [
    'pizza','burger','biryani','pasta','noodles','sandwich','dosa','idli',
    'chai','coffee','restaurant','cafe','zomato','swiggy','dinner','lunch',
    'breakfast','starbucks','mcdonalds','dominos','kfc','subway','haldirams',
    'faasos','behrouz','chaayos','buffet','dhaba','eating out','food delivery'
  ],
  Groceries: [
    'vegetables','fruits','milk','eggs','bread','butter','curd','grocery','supermarket',
    'dmart','big bazaar','reliance fresh','more supermarket','ration','flour','sugar','salt',
    'cooking oil','spices','masala','lentils','pulses','cereal','oats','instant food',
    'blinkit','zepto','instamart','bigbasket','nature basket'
  ],
  'Transport & Travel': [
    'uber','ola','rapido','metro','train','flight','bus','cab','auto fare','commute',
    'petrol','diesel','cng','fastag','toll','irctc','indigo','air india','spicejet','vistara',
    'makemytrip','goibibo','hotel stay','hotel booking','airbnb','redbus','zoomcar'
  ],
  Housing: [
    'house rent','apartment rent','flat rent','rent payment','society maintenance',
    'building maintenance','residential maintenance','property tax','plumber','electrician',
    'carpenter','pest control','house painting','water tank cleaning','maid salary','cook salary'
  ],
  'Utilities & Bills': [
    'electricity bill','electricity','light bill','power bill','water bill','piped gas','gas bill',
    'lpg cylinder','internet','wifi bill','broadband','mobile recharge','phone bill','postpaid bill',
    'dth recharge','tata play','airtel broadband','jio fiber','act fibernet'
  ],
  'Debt & Loan Payments': [
    'home loan emi','car loan emi','personal loan emi','education loan emi','bike loan emi',
    'loan emi','loan installment','loan repayment','credit card bill','credit card payment',
    'bajaj finserv emi','simpl bill','lazypay','kreditbee','zestmoney'
  ],
  Shopping: [
    'dress','clothes','shirt','jeans','shoes','sandals','sneakers','bag','purse','wallet',
    'jewellery','watch','sunglasses','perfume','amazon','flipkart','myntra','ajio','nykaa',
    'zara','h&m','uniqlo','ikea','croma','reliance digital','gift','headphones','electronics'
  ],
  Entertainment: [
    'movie','netflix','amazon prime','hotstar','spotify','youtube premium','gaming','ps5','xbox',
    'concert','comedy show','event ticket','theme park','bowling','multiplex','pvr','inox',
    'party','birthday party','nightclub','pub','bar','brewery','celebration','clubbing'
  ],
  Health: [
    'doctor','hospital','clinic','medicine','pharmacy','tablets','health checkup','blood test',
    'pathlab','dr lal pathlabs','metropolis','apollo pharmacy','medplus','tata 1mg','pharmeasy',
    'dentist','dental','optician','physiotherapy','vaccination','vitamin','therapy','counselling'
  ],
  Education: [
    'books','textbook','course','online course','udemy','coursera','upgrad','tuition','coaching',
    'college fees','school fees','university fees','semester fees','exam fees','certification',
    'study material','library','byjus','unacademy'
  ],
  'Personal Care': [
    'haircut','barbershop','barber','hair salon','beauty parlour','hair spa','facial','threading',
    'waxing','manicure','pedicure','nail art','body massage','spa','enrich salon','jawed habib',
    'skincare','cosmetics','sunscreen','moisturizer','shampoo','beard oil','grooming'
  ],
  Insurance: [
    'health insurance','star health','care health','hdfc ergo','niva bupa','icici lombard',
    'term insurance','life insurance','max life','lic premium','lic policy','car insurance',
    'bike insurance','vehicle insurance','motor insurance','travel insurance','policybazaar','insurance premium'
  ],
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
  Misc: [
    'miscellaneous','unclassified','general expense','cash withdrawal','petty cash'
  ],
};

const CATEGORY_TYPE_MAP = {
  'Food & Dining': 'Want',
  Groceries: 'Need',
  'Transport & Travel': 'Want',
  Housing: 'Need',
  'Utilities & Bills': 'Need',
  'Debt & Loan Payments': 'Need',
  Shopping: 'Want',
  Entertainment: 'Want',
  Health: 'Need',
  Education: 'Investment',
  'Personal Care': 'Want',
  Insurance: 'Need',
  Investments: 'Investment',
  Misc: 'Need',
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
test('1. Valid Categories array contains 14 canonical V3 categories + legacy compatibility', () => {
  const canonicalV3 = [
    'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
    'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
    'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
  ];
  for (const cat of canonicalV3) {
    assert.ok(VALID_CATEGORIES.includes(cat), `${cat} must be in VALID_CATEGORIES`);
  }
  assert.equal(canonicalV3.length, 14, 'Exactly 14 canonical V3 categories');
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

// ── TEST 3: Particular Bug Regression: Nifty50 and Nvidia shares NEVER return Food & Dining ─
test('3. CRITICAL BUG REGRESSION: "Nifty50" and "Nvidia shares" NEVER classify as Food & Dining', () => {
  const bugInputs = ['Nifty50', '50000 nifty 50', 'Nvidia shares', 'Bought Apple stock'];

  for (const input of bugInputs) {
    const res = classifyLocally(input);
    assert.notEqual(res.category, 'Food & Dining', `BUG REGRESSION: "${input}" classified as Food & Dining!`);
    assert.notEqual(res.category, 'Food', `BUG REGRESSION: "${input}" classified as Food!`);
    assert.equal(res.category, 'Investments', `"${input}" must be category Investments`);
    assert.equal(res.type, 'Investment', `"${input}" must be type Investment`);
  }
});

// ── TEST 4: Category Verification Across V3 Domains ──────────────────────────
test('4. All V3 categories properly classified in Node fallback', () => {
  const cases = [
    { text: 'Swiggy biryani', expectedCat: 'Food & Dining', expectedType: 'Want' },
    { text: 'Uber ride', expectedCat: 'Transport & Travel', expectedType: 'Want' },
    { text: 'Netflix subscription', expectedCat: 'Entertainment', expectedType: 'Want' },
    { text: 'Electricity bill', expectedCat: 'Utilities & Bills', expectedType: 'Need' },
    { text: 'DMart groceries', expectedCat: 'Groceries', expectedType: 'Need' },
    { text: 'Doctor consultation', expectedCat: 'Health', expectedType: 'Need' },
    { text: 'College tuition', expectedCat: 'Education', expectedType: 'Investment' },
    { text: 'New shoes shopping', expectedCat: 'Shopping', expectedType: 'Want' },
    { text: 'Birthday party', expectedCat: 'Entertainment', expectedType: 'Want' },
    { text: 'Monthly house rent', expectedCat: 'Housing', expectedType: 'Need' },
    { text: 'Home loan emi', expectedCat: 'Debt & Loan Payments', expectedType: 'Need' },
    { text: 'Star health insurance premium', expectedCat: 'Insurance', expectedType: 'Need' },
    { text: 'Haircut and beard trim', expectedCat: 'Personal Care', expectedType: 'Want' },
  ];

  for (const { text, expectedCat, expectedType } of cases) {
    const res = classifyLocally(text);
    assert.equal(res.category, expectedCat, `Category mismatch for "${text}"`);
    assert.equal(res.type, expectedType, `Type mismatch for "${text}"`);
  }
});

// ── TEST 5: Financial Accounting Invariance ──────────────────────────────────
test('5. Financial Accounting: isInvestment strictly evaluates type === "Investment" regardless of category', () => {
  const invTx = { amount: 25000, category: 'Investments', type: 'Investment' };
  assert.equal(isInvestment(invTx), true, 'Category: Investments, Type: Investment is investment');
  assert.equal(isConsumption(invTx), false, 'Investment is not consumption');

  const legacyInvTx = { amount: 10000, category: 'Misc', type: 'Investment' };
  assert.equal(isInvestment(legacyInvTx), true, 'Legacy Investment transaction is recognized as investment');

  const eduInvTx = { amount: 50000, category: 'Education', type: 'Investment' };
  assert.equal(isInvestment(eduInvTx), true, 'Education with type Investment is recognized as investment');

  const needTx = { amount: 5000, category: 'Utilities & Bills', type: 'Need' };
  assert.equal(isInvestment(needTx), false, 'Utilities & Bills/Need is not investment');
  assert.equal(isConsumption(needTx), true, 'Utilities & Bills/Need is consumption');
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
