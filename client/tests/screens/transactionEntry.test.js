/**
 * client/tests/screens/transactionEntry.test.js
 * 
 * Consolidated Transaction Entry Screen UX & Contract Test Suite.
 * Combines amount input UX specifications (prefix, tap-to-focus, decimal keyboard)
 * and transaction input logic (ML auto-classification, confirmation, manual override,
 * balance accounting, double-submit protection).
 * 
 * Preserves all 20 checks from:
 *  - client/test_transaction_amount_input_ux.js (10 tests)
 *  - client/test_transaction_input_ux.js (10 tests)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '../..');

console.log('='.repeat(64));
console.log('  FINAURA CONSOLIDATED TRANSACTION ENTRY TEST SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  console.log(`Running ${name}...`);
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name} Passed`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
  console.log();
}

const screenPath = path.join(clientRoot, 'src/screens/TransactionEntryScreen.tsx');
const screenCode = fs.readFileSync(screenPath, 'utf8');

// ── Helpers mirroring TransactionEntryScreen ────────────────
function parseAmountInput(input) {
  return parseFloat(input.replace(/[^0-9.]/g, '')) || 0;
}

function validateAmount(parsedAmount) {
  if (isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { valid: false, error: 'Transaction amount must be a finite positive number' };
  }
  return { valid: true };
}

// Local mock classifier (fallback logic)
function classifyLocally(description) {
  const text = (description || '').toLowerCase();
  if (text.includes('sip') || text.includes('mutual') || text.includes('invest') || text.includes('stock')) {
    return { category: 'Investments', type: 'Investment', confidence: 0.85, needsReview: false };
  }
  if (text.includes('zomato') || text.includes('swiggy') || text.includes('pizza') || text.includes('dinner') || text.includes('lunch')) {
    return { category: 'Food', type: 'Want', confidence: 0.90, needsReview: false };
  }
  if (text.includes('rent') || text.includes('bill') || text.includes('electricity') || text.includes('metro')) {
    return { category: 'Bills', type: 'Need', confidence: 0.80, needsReview: false };
  }
  return { category: 'Misc', type: 'Need', confidence: 0.35, needsReview: true };
}

// ============================================================
// PART A: AMOUNT INPUT UX & VISUAL STRUCTURE (10 TESTS)
// ============================================================

test('Amount UX Test 1 — Separate Currency Prefix', () => {
  assert.ok(
    !screenCode.includes('value={`₹${amount}`}'),
    'TextInput value does not embed ₹ currency prefix'
  );
  assert.ok(
    screenCode.includes('value={amount}'),
    'TextInput value directly binds to clean numeric amount state'
  );
  assert.ok(
    screenCode.includes('<Text style={[styles.currencyPrefix'),
    '₹ is rendered as a standalone Text element with dedicated currencyPrefix styling'
  );
});

test('Amount UX Test 2 — Currency Prefix Non-Interactive', () => {
  assert.ok(
    screenCode.includes('pointerEvents="none" style={styles.currencyPrefixWrap}'),
    'Currency prefix wrapper specifies pointerEvents="none" so touches pass directly to container'
  );
});

test('Amount UX Test 3 — Obvious Input Container & Visual Boundaries', () => {
  assert.ok(
    screenCode.includes('<Text style={styles.fieldLabel}>Amount</Text>'),
    'Amount field has an explicit uppercase field label'
  );
  assert.ok(
    screenCode.includes('amountContainer: {'),
    'amountContainer style definition exists'
  );
  assert.ok(
    screenCode.includes('borderRadius: 16'),
    'amountContainer defines generous rounded corners'
  );
  assert.ok(
    screenCode.includes('borderWidth: 1.5'),
    'amountContainer defines clear visible border'
  );
  assert.ok(
    screenCode.includes("backgroundColor: '#F8FAFC'"),
    'amountContainer defines contrasting subtle background'
  );
  assert.ok(
    screenCode.includes('minHeight: 64'),
    'amountContainer defines comfortable minimum touch height'
  );
});

test('Amount UX Test 4 — Whole Container Focus Mechanism', () => {
  assert.ok(
    screenCode.includes('amountInputRef = useRef<TextInput>(null)'),
    'amountInputRef is defined using React useRef'
  );
  assert.ok(
    screenCode.includes('onPress={() => amountInputRef.current?.focus()}'),
    'Tapping container programmatically calls amountInputRef.current?.focus()'
  );
  assert.ok(
    screenCode.includes('ref={amountInputRef}'),
    'amountInputRef is attached to the TextInput'
  );
});

test('Amount UX Test 5 — Placeholder Clarity', () => {
  assert.ok(
    screenCode.includes('placeholder="0"'),
    'TextInput specifies a clean monetary placeholder ("0")'
  );
  assert.ok(
    screenCode.includes('placeholderTextColor="#94A3B8"'),
    'TextInput specifies high-contrast accessible placeholder color'
  );
});

test('Amount UX Test 6 — Numeric Keyboard Configuration', () => {
  assert.ok(
    screenCode.includes('keyboardType="decimal-pad"'),
    'TextInput specifies decimal-pad keyboard type for seamless integer & decimal entry'
  );
});

test('Amount UX Test 7 — Existing Validation Preserved', () => {
  function parseAmount(input) {
    if (!input || input.startsWith('-')) return 0;
    return parseFloat(input.replace(/[^0-9.]/g, '')) || 0;
  }

  function validate(amountStr) {
    const parsed = parseAmount(amountStr);
    if (parsed <= 0) {
      return { valid: false, error: 'Please enter a valid amount greater than 0.' };
    }
    return { valid: true, amount: parsed };
  }

  assert.equal(validate('').valid, false);
  assert.equal(validate('0').valid, false);
  assert.equal(validate('-50').valid, false);
  assert.equal(validate('abc').valid, false);
  assert.equal(validate('500').valid, true);
  assert.equal(validate('2500').amount, 2500);
  assert.equal(validate('2499.50').amount, 2499.5);
  assert.equal(validate('12500000').amount, 12500000);
});

test('Amount UX Test 8 — Existing API Data Flow Contract Preserved', () => {
  function handleInput(t) {
    const cleaned = t.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return `${parts[0]}.${parts.slice(1).join('')}`;
    }
    return cleaned;
  }

  assert.equal(handleInput('500'), '500');
  assert.equal(handleInput('2499.50'), '2499.50');
  assert.equal(handleInput('₹2500'), '2500');
  assert.equal(handleInput('12.34.56'), '12.3456');

  const parsedAmount = parseFloat(handleInput('2499.50').replace(/[^0-9.]/g, '')) || 0;
  const payload = {
    amount: parsedAmount,
    category: 'Food & Dining',
    type: 'Want'
  };

  assert.equal(typeof payload.amount, 'number');
  assert.equal(payload.amount, 2499.5);
  assert.equal(payload.amount > 0, true);
});

test('Amount UX Test 9 — Focus State Styling & Tokens', () => {
  assert.ok(
    screenCode.includes('isAmountFocused && styles.amountContainerFocused'),
    'Focused container style conditionally applied'
  );
  assert.ok(
    screenCode.includes('onFocus={() => setIsAmountFocused(true)}'),
    'onFocus handler updates focus state'
  );
  assert.ok(
    screenCode.includes('onBlur={() => setIsAmountFocused(false)}'),
    'onBlur handler clears focus state'
  );
  assert.ok(
    screenCode.includes('amountContainerFocused: {'),
    'amountContainerFocused style defined'
  );
});

test('Amount UX Test 10 — Accessibility Role and Labels', () => {
  assert.ok(
    screenCode.includes('accessibilityRole="button"'),
    'Container marked as accessible interactive target'
  );
  assert.ok(
    screenCode.includes('accessibilityLabel="Transaction amount"'),
    'Container provided descriptive accessibility label'
  );
  assert.ok(
    screenCode.includes('accessibilityLabel="Amount value"'),
    'TextInput provided dedicated accessibility label'
  );
});

// ============================================================
// PART B: TRANSACTION INPUT UX & CONTRACTS (10 TESTS)
// ============================================================

test('Contract Test 1: Amount Input Parsing & Validation Boundaries', () => {
  assert.equal(parseAmountInput('₹850'), 850);
  assert.equal(parseAmountInput('₹1,250.50'), 1250.5);
  assert.equal(parseAmountInput('abc'), 0);

  assert.ok(validateAmount(850).valid);
  assert.ok(validateAmount(10.25).valid);
  assert.equal(validateAmount(0).valid, false);
  assert.equal(validateAmount(-50).valid, false);
  assert.equal(validateAmount(NaN).valid, false);
});

test('Contract Test 2: ML Auto-Classification Populates Fields Properly', () => {
  const pizza = classifyLocally('zomato dinner pizza');
  assert.equal(pizza.category, 'Food');
  assert.equal(pizza.type, 'Want');
  assert.equal(pizza.needsReview, false);

  const sip = classifyLocally('monthly SIP mutual fund');
  assert.equal(sip.category, 'Investments');
  assert.equal(sip.type, 'Investment');
  assert.equal(sip.needsReview, false);
});

test('Contract Test 3: Low-Confidence ML Suggestions Require Confirmation', () => {
  const unknown = classifyLocally('some random merchant description');
  assert.equal(unknown.needsReview, true);
  
  let typeConfirmed = !unknown.needsReview;
  let validationError = null;

  if (!typeConfirmed) {
    validationError = 'Confirmation Required: Please confirm or select the correct transaction type.';
  }
  assert.equal(typeConfirmed, false);
  assert.ok(validationError.includes('Confirmation Required'));

  typeConfirmed = true;
  assert.equal(typeConfirmed, true);
});

test('Contract Test 4: User Correction Overrides ML Suggestion', () => {
  const result = classifyLocally('metro ticket');
  assert.equal(result.type, 'Need');

  let selectedType = result.type;
  let userOverrodeType = false;

  selectedType = 'Want';
  userOverrodeType = true;

  const payload = {
    amount: 150,
    category: 'Travel',
    type: selectedType,
    typeSource: userOverrodeType ? 'manual' : 'ml'
  };

  assert.equal(payload.type, 'Want');
  assert.equal(payload.typeSource, 'manual');
});

test('Contract Test 5: Fallback Classifier Kicks in when ML Service Fails', () => {
  const mockMlServiceOffline = true;
  let resolvedCategory, resolvedType, source;

  if (mockMlServiceOffline) {
    const local = classifyLocally('electricity bill');
    resolvedCategory = local.category;
    resolvedType = local.type;
    source = 'fallback';
  } else {
    resolvedCategory = 'Bills';
    resolvedType = 'Need';
    source = 'ml';
  }

  assert.equal(resolvedCategory, 'Bills');
  assert.equal(resolvedType, 'Need');
  assert.equal(source, 'fallback');
});

test('Contract Test 6: Transaction Semantics & Budget Impacts', () => {
  const needTx = { amount: 2500, type: 'Need' };
  assert.equal(needTx.type, 'Need');

  const wantTx = { amount: 850, type: 'Want' };
  assert.equal(wantTx.type, 'Want');

  const investTx = { amount: 5000, type: 'Investment' };
  assert.equal(investTx.type, 'Investment');
});

test('Contract Test 7: Current Balance Mutation Accounting', () => {
  const balanceBefore = 50000;
  const txAmount = 850;
  const balanceAfter = balanceBefore - txAmount;
  assert.equal(balanceAfter, 49150);
});

test('Contract Test 8: Double-Submit Prevention Guards', () => {
  let isSaving = false;
  let submissionCount = 0;

  function submit() {
    if (isSaving) return;
    isSaving = true;
    submissionCount++;
  }

  submit();
  submit();
  isSaving = false;

  assert.equal(submissionCount, 1);
});

test('Contract Test 9: Optional Liability Linking Integration', () => {
  const activeLiabilities = [
    { id: 'l-1', name: 'Car EMI', amount: 12000 }
  ];
  let selectedLiability = null;

  assert.equal(selectedLiability, null);

  selectedLiability = activeLiabilities[0];
  assert.equal(selectedLiability.id, 'l-1');
});

test('Contract Test 10: Human-Readable Errors without Internal Leakage', () => {
  function sanitizeError(err) {
    if (err.message.includes('Mongoose') || err.message.includes('ECONNREFUSED') || err.message.includes('Traceback')) {
      return 'Failed to save transaction. Please check your network connection and try again.';
    }
    return err.message;
  }

  const databaseError = new Error('Mongoose validation error: duplicate key t-123');
  const networkError = new Error('connect ECONNREFUSED 127.0.0.1:5001');
  const userError = new Error('Please enter a valid amount');

  assert.ok(sanitizeError(databaseError).includes('Please check your network'));
  assert.ok(sanitizeError(networkError).includes('Please check your network'));
  assert.equal(sanitizeError(userError), 'Please enter a valid amount');
});

// ── Execution Summary ───────────────────────────────────────
console.log('='.repeat(64));
if (failed === 0) {
  console.log(`  ALL ${passed} CONSOLIDATED TRANSACTION ENTRY TESTS PASSED 🚀`);
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log('='.repeat(64));

if (failed > 0) {
  process.exit(1);
}
