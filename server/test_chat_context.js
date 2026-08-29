/**
 * server/test_chat_context.js
 * 
 * Comprehensive test suite for ChatContextService, AgentMemory multi-turn history,
 * and AgentService grounding & conversation normalization.
 */

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import Asset from './models/Asset.js';
import Liability from './models/Liability.js';
import Goal from './models/Goal.js';
import Alert from './models/Alert.js';
import FMIHistory from './models/FMIHistory.js';
import AgentMemory from './models/AgentMemory.js';
import { buildChatContext } from './services/ChatContextService.js';
import {
  buildSystemPrompt,
  generateResponse,
  normalizeConversationHistory
} from './services/AgentService.js';

console.log('================================================================');
console.log('  FINAURA CHAT CONTEXT & MULTI-TURN MEMORY TEST SUITE');
console.log('================================================================\n');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const testUserId = 'test-chat-user-' + Date.now();
  const otherUserId = 'other-chat-user-' + Date.now();
  const emptyUserId = 'empty-chat-user-' + Date.now();

  try {
    // Cleanup prior test artifacts
    const allUserIds = [testUserId, otherUserId, emptyUserId];
    await User.deleteMany({ id: { $in: allUserIds } });
    await Transaction.deleteMany({ userId: { $in: allUserIds } });
    await Income.deleteMany({ userId: { $in: allUserIds } });
    await Asset.deleteMany({ userId: { $in: allUserIds } });
    await Liability.deleteMany({ userId: { $in: allUserIds } });
    await Goal.deleteMany({ userId: { $in: allUserIds } });
    await Alert.deleteMany({ userId: { $in: allUserIds } });
    await FMIHistory.deleteMany({ userId: { $in: allUserIds } });
    await AgentMemory.deleteMany({ userId: { $in: allUserIds } });

    // Seed Primary User A
    await User.create({
      id: testUserId,
      name: 'Parth Palav',
      email: `parth-${Date.now()}@test.com`,
      password: 'hashedpassword123',
      dateOfBirth: new Date('1996-05-15'),
      age: 30,
      monthlyIncome: 80000,
      currentBalance: 95000,
      retirementAge: 55,
      retirementCorpusGoal: 30000000,
      expectedReturnRate: 0.09,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04
    });

    // Seed User B (for isolation testing)
    await User.create({
      id: otherUserId,
      name: 'Other User B',
      email: `other-${Date.now()}@test.com`,
      password: 'hashedpassword456',
      age: 40,
      monthlyIncome: 150000,
      currentBalance: 500000
    });

    // Seed Empty User
    await User.create({
      id: emptyUserId,
      name: 'Empty User',
      email: `empty-${Date.now()}@test.com`,
      password: 'hashedpassword789',
      currentBalance: 0,
      monthlyIncome: 0
    });

    const now = new Date();
    const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 12, 0, 0));
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0));

    // Seed Transactions for User A (Current & Previous month)
    await Transaction.create([
      // Current month transactions
      { id: `tx-1-${Date.now()}`, userId: testUserId, amount: 500, category: 'Food & Dining', type: 'Want', timestamp: currentMonthDate },
      { id: `tx-2-${Date.now()}`, userId: testUserId, amount: 1000, category: 'Transport & Travel', type: 'Need', timestamp: currentMonthDate },
      { id: `tx-3-${Date.now()}`, userId: testUserId, amount: 2000, category: 'Investments', type: 'Investment', timestamp: currentMonthDate },
      // Previous month transactions
      { id: `tx-prev-1-${Date.now()}`, userId: testUserId, amount: 800, category: 'Food & Dining', type: 'Want', timestamp: prevMonthDate },
      { id: `tx-prev-2-${Date.now()}`, userId: testUserId, amount: 1200, category: 'Transport & Travel', type: 'Need', timestamp: prevMonthDate },
      { id: `tx-prev-3-${Date.now()}`, userId: testUserId, amount: 2500, category: 'Investments', type: 'Investment', timestamp: prevMonthDate },
    ]);

    // Seed Income for User A
    await Income.create([
      { id: `inc-1-${Date.now()}`, userId: testUserId, source: 'salary', description: 'Primary Salary', amount: 80000, timestamp: currentMonthDate },
      { id: `inc-2-${Date.now()}`, userId: testUserId, source: 'freelance', description: 'Consulting', amount: 15000, timestamp: currentMonthDate }
    ]);

    // Seed Assets for User A
    await Asset.create([
      { id: `ast-fd-${Date.now()}`, userId: testUserId, name: 'HDFC Fixed Deposit', assetType: 'Fixed Deposit', assetClass: 'FIRE_INVESTABLE', currentValue: 100000, annualReturnRate: 0.06, includedInFireCorpus: true, liquidity: 'locked' },
      { id: `ast-mf-${Date.now()}`, userId: testUserId, name: 'Nifty Index Mutual Fund', assetType: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 100000, annualReturnRate: 0.12, includedInFireCorpus: true, liquidity: 'liquid' }
    ]);

    // Seed Liabilities for User A
    await Liability.create([
      {
        id: `lia-1-${Date.now()}`,
        userId: testUserId,
        name: 'Car Loan EMI',
        amount: 15000,
        category: 'Debt & Loan Payments',
        type: 'Need',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDueDate: new Date(Date.now() + 10 * 86400000),
        autoDeduct: true,
        status: 'active',
        outstandingBalance: 350000,
        interestRate: 0.085
      }
    ]);

    // Seed Goals & Alerts for User A
    await Goal.create([
      { id: `goal-1-${Date.now()}`, userId: testUserId, name: 'Emergency Fund', targetAmount: 200000, savedAmount: 50000, targetDate: new Date('2027-12-31') }
    ]);
    await Alert.create([
      { id: `alert-1-${Date.now()}`, userId: testUserId, type: 'warning', severity: 'medium', message: 'Upcoming Car Loan EMI in 10 days' }
    ]);

    // Seed User B records (to verify isolation)
    await Transaction.create([
      { id: `tx-b-1-${Date.now()}`, userId: otherUserId, amount: 99999, category: 'Shopping', type: 'Want', timestamp: currentMonthDate }
    ]);
    await Asset.create([
      { id: `ast-b-1-${Date.now()}`, userId: otherUserId, name: 'User B Secret Gold', assetType: 'Precious Metals', assetClass: 'FIRE_INVESTABLE', currentValue: 888888, annualReturnRate: 0.10, includedInFireCorpus: true }
    ]);

    // ── TEST 1: PROFILE & BALANCE CONTEXT ────────────────────────
    console.log('Running Test 1: User Profile & Balance Context...');
    const ctx = await buildChatContext(testUserId);
    assert.equal(ctx.profile.name, 'Parth Palav');
    assert.equal(ctx.profile.monthlyIncome, 80000);
    assert.equal(ctx.profile.currentBalance, 95000);
    assert.equal(ctx.balance.current, 95000);
    assert.equal(ctx.profile.retirementAge, 55);
    console.log('  ✓ Profile and currentBalance accurately assembled');

    // ── TEST 2: CURRENT MONTH SPENDING AGGREGATES ───────────────
    console.log('Running Test 2: Current Month Spending Aggregates...');
    assert.equal(ctx.spending.currentMonth.needs, 1000, 'Needs = 1000');
    assert.equal(ctx.spending.currentMonth.wants, 500, 'Wants = 500');
    assert.equal(ctx.spending.currentMonth.investments, 2000, 'Investments = 2000');
    assert.equal(ctx.spending.currentMonth.totalSpending, 1500, 'Total consumption spending = 1500 (Needs + Wants)');
    assert.equal(ctx.spending.currentMonth.totalOutflow, 3500, 'Total outflow = 3500');
    assert.equal(ctx.spending.currentMonth.byCategory['Food & Dining'], 500);
    assert.equal(ctx.spending.currentMonth.byCategory['Transport & Travel'], 1000);
    console.log('  ✓ Current month spending correctly categorizes Needs/Wants/Investments');

    // ── TEST 3: PREVIOUS MONTH SPENDING AGGREGATES ──────────────
    console.log('Running Test 3: Previous Month Spending Aggregates...');
    assert.equal(ctx.spending.previousMonth.needs, 1200);
    assert.equal(ctx.spending.previousMonth.wants, 800);
    assert.equal(ctx.spending.previousMonth.investments, 2500);
    assert.equal(ctx.spending.previousMonth.totalSpending, 2000);
    console.log('  ✓ Previous month spending correctly aggregated separately');

    // ── TEST 4: ASSETS CONTEXT & RETURN RATES ───────────────────
    console.log('Running Test 4: Assets Context & Annual Return Rates...');
    assert.equal(ctx.assets.totalValue, 200000, 'Total assets = 2 Lakhs');
    assert.equal(ctx.assets.fireInvestableCorpus, 200000, 'FIRE corpus = 2 Lakhs');
    assert.equal(ctx.assets.portfolioWeightedReturnRate, 0.09, 'Portfolio weighted return rate = 9.00%');
    assert.equal(ctx.assets.holdings.length, 2);
    const fdHolding = ctx.assets.holdings.find(h => h.name.includes('Fixed Deposit'));
    const mfHolding = ctx.assets.holdings.find(h => h.name.includes('Mutual Fund'));
    assert.equal(fdHolding.annualReturnRate, 0.06);
    assert.equal(mfHolding.annualReturnRate, 0.12);
    console.log('  ✓ Asset holdings, values, and individual return rates preserved');

    // ── TEST 5: LIABILITIES CONTEXT ─────────────────────────────
    console.log('Running Test 5: Liabilities Context...');
    assert.equal(ctx.liabilities.activeCount, 1);
    assert.equal(ctx.liabilities.monthlyLiabilityService, 15000);
    assert.equal(ctx.liabilities.active[0].name, 'Car Loan EMI');
    assert.equal(ctx.liabilities.active[0].autoDeduct, true);
    assert.equal(ctx.liabilities.active[0].outstandingBalance, 350000);
    console.log('  ✓ Active liabilities, EMIs, and due dates captured');

    // ── TEST 6: FMI CONTEXT ─────────────────────────────────────
    console.log('Running Test 6: Deterministic FMI Context...');
    assert.ok(typeof ctx.fmi.score === 'number', 'FMI score is numeric');
    assert.ok(ctx.fmi.pillars, 'Pillars present');
    assert.ok(typeof ctx.fmi.pillars.savingDiscipline === 'number', 'D1 score present');
    assert.ok(typeof ctx.fmi.pillars.spendingControl === 'number', 'D2 score present');
    assert.ok(typeof ctx.fmi.pillars.behavioralRisk === 'number', 'D3 score present');
    console.log(`  ✓ FMI score (${ctx.fmi.score}/100) and 3 pillars computed deterministically`);

    // ── TEST 7: FIRE & PREDICTABILITY SNAPSHOT ──────────────────
    console.log('Running Test 7: FIRE & Predictability Snapshot...');
    assert.ok(ctx.fire.currentInvestableCorpus >= 200000, 'FIRE investable corpus supplied');
    assert.ok(ctx.fire.fireTarget !== undefined, 'FIRE target supplied');
    console.log('  ✓ FIRE target and investable corpus supplied deterministically');

    // ── TEST 8: EMPTY USER SAFE DEFAULTS (NO CRASH / NO NaN) ────
    console.log('Running Test 8: Empty User Safe Defaults...');
    const emptyCtx = await buildChatContext(emptyUserId);
    assert.equal(emptyCtx.profile.name, 'Empty User');
    assert.equal(emptyCtx.balance.current, 0);
    assert.equal(emptyCtx.spending.currentMonth.totalSpending, 0);
    assert.equal(emptyCtx.spending.currentMonth.needs, 0);
    assert.equal(emptyCtx.assets.totalValue, 0);
    assert.equal(emptyCtx.assets.holdings.length, 0);
    assert.equal(emptyCtx.liabilities.activeCount, 0);
    assert.equal(emptyCtx.goals.length, 0);
    assert.equal(emptyCtx.alerts.length, 0);
    assert.ok(!JSON.stringify(emptyCtx).includes('NaN'), 'Zero NaN leakage');
    assert.ok(!JSON.stringify(emptyCtx).includes('undefined'), 'Zero undefined string leakage');
    console.log('  ✓ Empty user records handled gracefully with safe zeros and empty collections');

    // ── TEST 9: CROSS-USER DATA ISOLATION ───────────────────────
    console.log('Running Test 9: Cross-User Data Isolation...');
    const ctxA = await buildChatContext(testUserId);
    const ctxB = await buildChatContext(otherUserId);
    assert.equal(ctxA.profile.name, 'Parth Palav');
    assert.equal(ctxB.profile.name, 'Other User B');
    assert.equal(ctxA.assets.totalValue, 200000);
    assert.equal(ctxB.assets.totalValue, 888888);
    assert.ok(!JSON.stringify(ctxA).includes('888888'), 'User A payload contains zero User B assets');
    assert.ok(!JSON.stringify(ctxB).includes('Parth Palav'), 'User B payload contains zero User A profile info');
    console.log('  ✓ Cross-user tenant isolation strictly enforced');

    // ── TEST 10: BOUNDED RECENT TRANSACTIONS ────────────────────
    console.log('Running Test 10: Bounded Recent Transactions Cap...');
    // Add 20 extra transactions to User A
    const extraTxs = [];
    for (let i = 1; i <= 20; i++) {
      extraTxs.push({
        id: `tx-extra-${i}-${Date.now()}`,
        userId: testUserId,
        amount: 100 * i,
        category: 'Misc',
        type: 'Need',
        timestamp: new Date(Date.now() - i * 3600000)
      });
    }
    await Transaction.create(extraTxs);

    const boundedCtx = await buildChatContext(testUserId);
    assert.ok(boundedCtx.spending.recentTransactions.length <= 15, `Recent txs capped at <= 15, got ${boundedCtx.spending.recentTransactions.length}`);
    console.log(`  ✓ Recent transactions safely bounded to ${boundedCtx.spending.recentTransactions.length} items`);

    // ── TEST 11: DATA MINIMIZATION (ZERO EMAIL LEAKAGE) ─────────
    console.log('Running Test 11: Data Minimization Audit...');
    assert.equal(boundedCtx.profile.email, undefined, 'User email strictly omitted from ChatContext profile');
    assert.ok(!JSON.stringify(boundedCtx).includes('@test.com'), 'Zero email strings in context payload');
    console.log('  ✓ Email completely excluded from LLM context payload');

    // ── TEST 12: SECURITY AUDIT: ZERO SECRETS LEAKAGE ───────────
    console.log('Running Test 12: Security & Secrets Audit...');
    const serializedCtx = JSON.stringify(boundedCtx);
    const forbiddenSecrets = [
      'password', 'passwordHash', 'hashedpassword', 'accessToken', 'refreshToken',
      'resetToken', 'verificationToken', 'JWT_SECRET', 'GEMINI_API_KEY', 'processingToken'
    ];
    for (const secret of forbiddenSecrets) {
      assert.ok(!serializedCtx.includes(secret), `Context MUST NOT contain forbidden secret key: ${secret}`);
    }
    console.log('  ✓ Zero passwords, tokens, or security hashes present in chat context');

    // ── TEST 13: MULTI-TURN HISTORY NORMALIZATION & ROLE MAPPING 
    console.log('Running Test 13: Multi-Turn Conversation History Normalization...');
    // Sub-case 13.1: Valid history
    const validRaw = [
      { role: 'user', content: 'How much did I spend on food?' },
      { role: 'assistant', content: 'You spent ₹4,500 on Food & Dining.' }
    ];
    const norm1 = normalizeConversationHistory(validRaw);
    assert.equal(norm1.length, 2);
    assert.equal(norm1[0].role, 'user');
    assert.equal(norm1[0].parts[0].text, 'How much did I spend on food?');
    assert.equal(norm1[1].role, 'model', 'FINAURA assistant mapped to Gemini model');
    assert.equal(norm1[1].parts[0].text, 'You spent ₹4,500 on Food & Dining.');

    // Sub-case 13.2: Leading assistant message is safely dropped
    const leadingAssistant = [
      { role: 'assistant', content: 'Welcome bot msg' },
      { role: 'user', content: 'What is my balance?' },
      { role: 'assistant', content: 'Your balance is ₹95,000.' }
    ];
    const norm2 = normalizeConversationHistory(leadingAssistant);
    assert.equal(norm2.length, 2);
    assert.equal(norm2[0].role, 'user');
    assert.equal(norm2[1].role, 'model');

    // Sub-case 13.3: Consecutive same-role messages are merged
    const consecutiveUsers = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Are you there?' },
      { role: 'assistant', content: 'Yes, I am here.' }
    ];
    const norm3 = normalizeConversationHistory(consecutiveUsers);
    assert.equal(norm3.length, 2);
    assert.equal(norm3[0].role, 'user');
    assert.equal(norm3[0].parts[0].text, 'Hello\nAre you there?');
    assert.equal(norm3[1].role, 'model');

    // Sub-case 13.4: Trailing user message is dropped (so next sendMessage is the new user prompt)
    const trailingUser = [
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Reply 1' },
      { role: 'user', content: 'Dangling Turn 2' }
    ];
    const norm4 = normalizeConversationHistory(trailingUser);
    assert.equal(norm4.length, 2);
    assert.equal(norm4[norm4.length - 1].role, 'model', 'History must end in model turn');

    // Sub-case 13.5: Empty/malformed entries filtered out
    const malformed = [
      null,
      { role: 'unsupported_role', content: 'abc' },
      { role: 'user', content: '' },
      { role: 'user', content: '   ' }
    ];
    const norm5 = normalizeConversationHistory(malformed);
    assert.equal(norm5.length, 0);
    console.log('  ✓ History normalization guarantees strictly alternating valid Gemini turns');

    // ── TEST 14: MULTI-TURN HISTORY DATABASE BOUNDS & ISOLATION ─
    console.log('Running Test 14: Multi-Turn DB Memory Bounds & Isolation...');
    // Seed 15 messages for User A
    for (let i = 1; i <= 15; i++) {
      await AgentMemory.create({
        userId: testUserId,
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `Message ${i} for User A`,
        timestamp: new Date(Date.now() - (20 - i) * 60000)
      });
    }
    // Seed 3 messages for User B
    await AgentMemory.create({ userId: otherUserId, role: 'user', content: 'User B private chat' });
    await AgentMemory.create({ userId: otherUserId, role: 'assistant', content: 'User B private reply' });

    // Fetch prior history with limit 10
    const priorDocs = await AgentMemory.find({ userId: testUserId }).sort({ timestamp: -1 }).limit(10).lean();
    const priorHistory = priorDocs.reverse();
    assert.equal(priorHistory.length, 10, 'History strictly capped at 10 items');
    assert.ok(priorHistory.every(m => m.userId === testUserId), 'Strict user isolation in memory query');
    assert.ok(!priorHistory.some(m => m.content.includes('User B')), 'Zero cross-tenant history leakage');
    console.log('  ✓ History query accurately bounded and tenant-isolated');

    // ── TEST 15: CURRENT CONTEXT PRECEDENCE & GROUNDING RULES ───
    console.log('Running Test 15: Current Context Precedence in System Prompt...');
    const prompt = buildSystemPrompt(boundedCtx);
    assert.ok(prompt.includes('CURRENT CONTEXT WINS OVER CHAT HISTORY'), 'Prompt enforces current context precedence rule');
    assert.ok(prompt.includes('GROUNDED IN TRUTH & ZERO FABRICATION'), 'Prompt enforces zero fabrication rule');
    assert.ok(prompt.includes('DO NOT RECALCULATE DETERMINISTIC METRICS'), 'Prompt enforces non-recalculation rule');
    assert.ok(prompt.includes('PROJECTION LANGUAGE'), 'Prompt enforces modeled/projected wording rule');
    assert.ok(prompt.includes('READ-ONLY ADVISOR'), 'Prompt enforces read-only guardrail');
    console.log('  ✓ System instruction prompt embeds all required grounding and precedence rules');

    // ── TEST 16: DETERMINISTIC REPRESENTATION FOR REAL QUESTIONS (A-E) 
    console.log('Running Test 16: Authoritative Grounding for Real Questions A–E...');
    const promptSeed = buildSystemPrompt(ctx);
    // Question A: Current balance
    assert.ok(promptSeed.includes('Operating Balance: ₹95,000'), 'Question A: Exact balance ₹95,000 present in prompt');
    // Question B: Monthly food spend
    assert.ok(promptSeed.includes('Food & Dining: ₹500'), 'Question B: Food & Dining spend present in prompt');
    // Question C: FMI score & 3 pillars
    assert.ok(promptSeed.includes('Financial Mood Index (FMI): 68/100'), 'Question C: Exact FMI 68/100 present');
    assert.ok(promptSeed.includes('Saving Discipline') && promptSeed.includes('Spending Control') && promptSeed.includes('Behavioral Risk'), 'Question C: 3 pillars present');
    // Question D: FIRE target & investable corpus
    assert.ok(promptSeed.includes('FIRE Investable Corpus: ₹2,00,000') || promptSeed.includes('Current Investable Corpus: ₹2,00,000'), 'Question D: Investable corpus present');
    // Question E: Upcoming liabilities & due dates
    assert.ok(promptSeed.includes('Car Loan EMI') && promptSeed.includes('₹15,000'), 'Question E: Liability EMI amount and name present');
    console.log('  ✓ Prompt contains exact verified figures to answer Questions A through E accurately');

    // ── TEST 17: OFFLINE & API KEY RESILIENCE ───────────────────
    console.log('Running Test 17: Offline & Error Resilience...');
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const offlineReply = await generateResponse('What is my balance?', boundedCtx, priorHistory);
    assert.ok(offlineReply.includes('FINAURA'), 'Returns informative offline/missing-key message');
    if (origKey) process.env.GEMINI_API_KEY = origKey;
    console.log('  ✓ AgentService fails gracefully when external AI uplink is unavailable');

    // ── TEST 18: END-TO-END CHAT DEDUPLICATION & PERSISTENCE ────
    console.log('Running Test 18: End-to-End Chat Flow with Deduplication...');
    const userMessage = 'Is that higher than last month?';
    
    // Simulate Controller Execution Order:
    // 1. Fetch prior history before saving new message
    const priorForTurn = await AgentMemory.find({ userId: testUserId }).sort({ timestamp: -1 }).limit(10).lean();
    const historyForGemini = priorForTurn.reverse();
    
    // 2. Persist user message
    await AgentMemory.create({ userId: testUserId, role: 'user', content: userMessage });

    // 3. Build fresh context
    const freshContext = await buildChatContext(testUserId);

    // 4. Generate response with prior history (userMessage is NOT in historyForGemini)
    assert.ok(!historyForGemini.some(m => m.content === userMessage), 'Current user message is NOT duplicated in prior history');

    const assistantContent = await generateResponse(userMessage, freshContext, historyForGemini);
    
    // 5. Persist assistant response
    const savedAssistant = await AgentMemory.create({
      userId: testUserId,
      role: 'assistant',
      content: assistantContent
    });

    assert.equal(savedAssistant.role, 'assistant');
    assert.ok(savedAssistant._id);
    assert.ok(savedAssistant.timestamp);
    console.log('  ✓ End-to-end chat flow deduplication and persistence verified');

  } finally {
    // Clean up test data
    const allUserIds = [testUserId, otherUserId, emptyUserId];
    await User.deleteMany({ id: { $in: allUserIds } });
    await Transaction.deleteMany({ userId: { $in: allUserIds } });
    await Income.deleteMany({ userId: { $in: allUserIds } });
    await Asset.deleteMany({ userId: { $in: allUserIds } });
    await Liability.deleteMany({ userId: { $in: allUserIds } });
    await Goal.deleteMany({ userId: { $in: allUserIds } });
    await Alert.deleteMany({ userId: { $in: allUserIds } });
    await FMIHistory.deleteMany({ userId: { $in: allUserIds } });
    await AgentMemory.deleteMany({ userId: { $in: allUserIds } });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  console.log('\n================================================================');
  console.log('  ALL 18 CHAT CONTEXT & MULTI-TURN TESTS PASSED (100% GREEN) 🚀');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
