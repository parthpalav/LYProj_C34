import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const BASE_URL = 'http://localhost:4000/api';
let AUTH_TOKEN = null;

const TEST_EMAIL = 'v2-integration-test@finaura.test';
const TEST_PASSWORD = 'Test@Pass123!';

let passed = 0;
let failed = 0;
const testResults = [];

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    testResults.push(`  ✅ ${name}`);
  } else {
    failed++;
    testResults.push(`  ❌ ${name} ${details ? '— ' + details : ''}`);
  }
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function setup() {
  console.log('\n⏳ Setting up test user for V2/MiniLM Integration tests...');
  let res = await api('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status === 200 && res.data.token) {
    AUTH_TOKEN = res.data.token;
    return true;
  }

  res = await api('POST', '/auth/register', {
    name: 'V2 Integration Tester',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    monthlyIncome: 60000,
    retirementAge: 60
  });

  if (res.status === 201 || res.status === 200) {
    res = await api('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
    if (res.data.token) {
      AUTH_TOKEN = res.data.token;
      return true;
    }
  }
  return false;
}

// Sources the ML layer reports when no rule matches: the fine-tuned joint model (finaura_v4) when it is
// loaded, else the legacy pair (TF-IDF for category, MiniLM for type).
const MODEL_SOURCES = { category: ['finaura_v4', 'tfidf_v2', 'tfidf'], type: ['finaura_v4', 'minilm'] };

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('  V2 & MINILM INTEGRATION REGRESSION TESTS');
  console.log('='.repeat(70));

  // Test 1: Category Integration (Rules vs TF-IDF V2)
  {
    // Rules win
    let res = await api('POST', '/classify', { text: 'Netflix subscription' });
    assert(res.data.category === 'Entertainment' && res.data.categorySource === 'merchant_rule', 
      'Category Integration: Rule wins for Netflix', `got ${res.data.category} / ${res.data.categorySource}`);
    
    // ML model fallback
    res = await api('POST', '/classify', { text: 'ordered some delivery meal from an online kitchen because did not cook' });
    assert(res.data.category === 'Food & Dining' && MODEL_SOURCES.category.includes(res.data.categorySource),
      'Category Integration: Fallback to the ML model for contextual food description', `got ${res.data.category} / ${res.data.categorySource}`);
  }

  // Test 2: Type Integration & Confidence Policy
  {
    // Deterministic rule type wins
    let res = await api('POST', '/classify', { text: 'Apollo Pharmacy' });
    assert(res.data.type === 'Need' && res.data.typeSource === 'merchant_rule' && res.data.needsReview === false,
      'Type Integration: Rule wins for Apollo Pharmacy', `got ${res.data.type} / ${res.data.typeSource}`);

    // Contextual ML invocation (High Confidence >= 0.75 -> typeConfidence >= 0.75)
    res = await api('POST', '/classify', { text: 'funded an online portfolio for my long-term wealth building' });
    assert(res.data.type === 'Investment' && MODEL_SOURCES.type.includes(res.data.typeSource),
      'Type Integration: ML model handles Investment', `got ${res.data.type} / ${res.data.typeSource}`);
    assert(res.data.typeConfidence >= 0.75, 'Type Integration: High confidence type prediction has typeConfidence >= 0.75', `got ${res.data.typeConfidence}`);

    // Low-confidence ML prediction -> needsReview = true. Gibberish stays uncertain on every model;
    // a merely unusual phrase (the old 'essential oil diffuser' case) gets learned by newer models.
    res = await api('POST', '/classify', { text: 'zxqv plorb 7731' });
    assert(MODEL_SOURCES.type.includes(res.data.typeSource) && res.data.needsReview === true,
      'Type Integration: Low confidence type prediction triggers needsReview = true', `got ${res.data.typeSource} / needsReview=${res.data.needsReview}`);
  }

  // Test 3: Metadata Persistence on Database
  let createdTxId = null;
  {
    const res = await api('POST', '/transactions', {
      amount: 5000,
      description: 'funded an online portfolio for my long-term wealth building',
      timestamp: new Date().toISOString()
    });
    const tx = res.data;
    createdTxId = tx?.id;
    assert(res.status === 201, 'Persistence: Transaction created via backend auto-inference');
    assert(['Investments', 'Education', 'Misc'].includes(tx?.category) && tx?.type === 'Investment', 'Persistence: Correctly inferred category and type', `got ${tx?.category}/${tx?.type}`);
    assert(MODEL_SOURCES.category.includes(tx?.categorySource) && MODEL_SOURCES.type.includes(tx?.typeSource), 'Persistence: Correctly saved categorySource and typeSource metadata', `got ${tx?.categorySource}/${tx?.typeSource}`);
    assert(tx?.categoryConfidence > 0 && tx?.typeConfidence >= 0.75, 'Persistence: Correctly saved categoryConfidence and typeConfidence', `cat: ${tx?.categoryConfidence}, type: ${tx?.typeConfidence}`);
  }

  // Test 4: PUT update manual overrides
  {
    const res = await api('PUT', `/transactions/${createdTxId}`, {
      type: 'Want',
      description: 'Manually changed corporate bond to Want (discretionary)'
    });
    const tx = res.data;
    assert(res.status === 200, 'Persistence: PUT update succeeds');
    assert(tx?.type === 'Want', 'Persistence: Type updated to Want');
    assert(tx?.typeSource === 'manual' && tx?.typeConfidence === 1.0, 'Persistence: typeSource updated to manual and typeConfidence to 1.0', `source: ${tx?.typeSource}`);
    assert(tx?.needsReview === false, 'Persistence: needsReview is false for manual edits');
  }

  // Clean up
  if (createdTxId) {
    await api('DELETE', `/transactions/${createdTxId}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  testResults.forEach(r => console.log(r));
  console.log(`\nPassed: ${passed} | Failed: ${failed}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

setup().then(ok => {
  if (ok) runTests();
  else {
    console.error('Setup failed.');
    process.exit(1);
  }
});
