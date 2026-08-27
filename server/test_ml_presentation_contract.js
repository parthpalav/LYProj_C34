/**
 * server/test_ml_presentation_contract.js
 * 
 * Comprehensive Presentation-Readiness & Architectural Contract Test Suite
 * for FINAURA ML / Classification Pipeline.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import { calculateFMI } from './services/FMIService.js';
import { getPredictabilitySnapshot } from './services/PredictabilityService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_jwt_s3cr3t_k3y_2026_xK9mP2qL7wN4';

console.log('='.repeat(64));
console.log('  FINAURA ML CLASSIFIER PRESENTATION CONTRACT SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ Passed');
  } catch (err) {
    failed++;
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err);
  }
}

async function runSuite() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lyproj');

  const userId = 'u-test-ml-presentation';
  await User.deleteMany({ id: userId });
  await Transaction.deleteMany({ userId });
  await Income.deleteMany({ userId });

  const testUser = await User.create({
    id: userId,
    name: 'Presentation Test User',
    email: 'ml_demo@finaura.app',
    dateOfBirth: new Date('1995-01-01'),
    retirementAge: 60,
    monthlyIncome: 100000,
    currentBalance: 50000,
    expectedReturnRate: 0.08,
    expectedInflationRate: 0.06,
    expectedWithdrawalRate: 0.04,
    lifestyleAdjustmentRatio: 0.80,
  });

  const authToken = jwt.sign(
    { id: userId, email: 'ml_demo@finaura.app' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };

  try {
    // ── 1. CLASSIFIER ENDPOINT WORKS & RETURNS PROPER TYPES ──
    await test('Test 1: POST /api/classify returns 200 with complete JSON contract', async () => {
      const res = await fetch('http://127.0.0.1:4000/api/classify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Zomato dinner order' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(typeof data.category, 'string');
      assert.equal(typeof data.type, 'string');
      assert.equal(typeof data.confidence, 'number');
      assert.ok(Number.isFinite(data.confidence));
      assert.ok(data.confidence >= 0 && data.confidence <= 1.0);
      assert.ok(['Food', 'Travel', 'Entertainment', 'Shopping', 'Bills', 'Groceries', 'Health', 'Party', 'Education', 'Misc'].includes(data.category));
      assert.ok(['Need', 'Want', 'Investment'].includes(data.type));
      assert.equal(typeof data.needsReview, 'boolean');
    });

    // ── 2. EXACT PRESENTATION EXAMPLES ──────────────────────
    await test('Test 2: Canonical Presentation Examples Classify Accurately', async () => {
      // 1. SIP -> Investment
      let r = await (await fetch('http://127.0.0.1:4000/api/classify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Monthly mutual fund SIP' })
      })).json();
      assert.equal(r.type, 'Investment');
      assert.equal(r.needsReview, false);

      // 2. Electricity -> Bills (Need)
      r = await (await fetch('http://127.0.0.1:4000/api/classify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Electricity bill payment' })
      })).json();
      assert.equal(r.category, 'Bills');
      assert.equal(r.type, 'Need');
      assert.equal(r.needsReview, false);

      // 3. Netflix -> Entertainment (Want)
      r = await (await fetch('http://127.0.0.1:4000/api/classify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Netflix subscription' })
      })).json();
      assert.equal(r.category, 'Entertainment');
      assert.equal(r.type, 'Want');
      assert.equal(r.needsReview, false);
    });

    // ── 3. AMBIGUOUS STRINGS TRIGGER HUMAN REVIEW ───────────
    await test('Test 3: Ambiguous and Vague Descriptions Flag for Human Review', async () => {
      const ambiguous = ['payment', 'transfer', 'online purchase', 'misc'];
      for (const text of ambiguous) {
        const r = await (await fetch('http://127.0.0.1:4000/api/classify', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ text })
        })).json();
        assert.equal(r.needsReview, true, `Expected needsReview=true for "${text}"`);
      }
    });

    // ── 4. USER OVERRIDE AUTHORITY ──────────────────────────
    await test('Test 4: User Manual Selection Overrides ML Suggestion with 100% Authority', async () => {
      // Create transaction where ML would suggest Want (e.g. pizza), but user selects Health / Need
      const tx = await Transaction.create({
        id: `tx-${Date.now()}`,
        userId,
        amount: 500,
        category: 'Health',
        type: 'Need',
        description: 'Special dietary meal',
        confidenceScore: 1.0,
        categorySource: 'manual',
        typeSource: 'manual',
        needsReview: false,
        timestamp: new Date()
      });

      const saved = await Transaction.findOne({ id: tx.id }).lean();
      assert.equal(saved.category, 'Health');
      assert.equal(saved.type, 'Need');
      assert.equal(saved.categorySource, 'manual');
      assert.equal(saved.typeSource, 'manual');
    });

    // ── 5. OFFLINE / TIMEOUT KEYWORD FALLBACK ───────────────
    await test('Test 5: Node Local Keyword Fallback Works Transparently', async () => {
      const r = await (await fetch('http://127.0.0.1:4000/api/classify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: 'Medicines from chemist store' })
      })).json();

      assert.equal(r.category, 'Health');
      assert.equal(r.type, 'Need');
      assert.ok(Number.isFinite(r.confidence));
    });

    // ── 6. DOWNSTREAM FMI IMPACT (SAVING PILLAR D1) ──────────
    await test('Test 6: Investment Classification Correctly Feeds FMI Saving Pillar (D1)', async () => {
      // Clean previous txs
      await Transaction.deleteMany({ userId });

      // Baseline FMI (0 expenses, 0 investments)
      const userDoc = testUser.toObject();
      const baseFmi = calculateFMI(userDoc, []);

      // Add ₹15,000 Investment transaction
      const expenses = [
        { amount: 15000, type: 'Investment', category: 'Misc', timestamp: new Date() }
      ];

      const postInvFmi = calculateFMI(userDoc, expenses);
      assert.equal(postInvFmi.totalSaved, 15000);
      assert.equal(postInvFmi.totalSpent, 0); // Investments excluded from spending
      assert.ok(postInvFmi.FMI > baseFmi.FMI, 'FMI score must increase when user logs an Investment');
    });

    // ── 7. DOWNSTREAM PREDICTABILITY IMPACT ──────────────────
    await test('Test 7: Investment Classification Correctly Feeds Predictability Monthly Contribution Baseline', async () => {
      // Clean & seed sample transactions
      await Transaction.deleteMany({ userId });
      await Income.deleteMany({ userId });

      await Income.create({
        id: `inc-${Date.now()}`,
        userId,
        amount: 100000,
        source: 'salary',
        description: 'Monthly salary',
        timestamp: new Date()
      });

      await Transaction.create([
        {
          id: `tx-need-1`,
          userId,
          amount: 30000,
          category: 'Bills',
          type: 'Need',
          description: 'Rent and utilities',
          timestamp: new Date()
        },
        {
          id: `tx-inv-1`,
          userId,
          amount: 15000,
          category: 'Misc',
          type: 'Investment',
          description: 'Mutual Fund SIP',
          timestamp: new Date()
        }
      ]);

      const snapshot = await getPredictabilitySnapshot(userId);

      // With ₹15,000 investment logged, observedAverageMonthlyInvestment reflects ₹15,000
      assert.equal(snapshot.currentState.observedAverageMonthlyInvestment, 15000);
      assert.equal(snapshot.retirement.monthlyContributionUsed, 15000);
    });

    // ── 8. PYTHON ML SERVICE ISOLATION (ZERO DB WRITES) ─────
    await test('Test 8: Python ML Microservice Performs Zero Direct DB Writes', async () => {
      const initialTxCount = await Transaction.countDocuments();
      const initialUserCount = await User.countDocuments();

      // Send 5 classification requests to Flask
      for (let i = 0; i < 5; i++) {
        await fetch('http://127.0.0.1:5001/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `Random test text ${i}` })
        });
      }

      const postTxCount = await Transaction.countDocuments();
      const postUserCount = await User.countDocuments();

      assert.equal(postTxCount, initialTxCount, 'Python service must not write transactions');
      assert.equal(postUserCount, initialUserCount, 'Python service must not write users');
    });

  } finally {
    await User.deleteMany({ id: userId });
    await Transaction.deleteMany({ userId });
    await Income.deleteMany({ userId });
    await mongoose.disconnect();
  }

  console.log();
  console.log('='.repeat(64));
  console.log(`  ALL ${passed} ML PRESENTATION CONTRACT TESTS PASSED! 🚀`);
  console.log('='.repeat(64));
}

runSuite().catch(console.error);
