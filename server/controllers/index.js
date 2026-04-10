import { Router } from 'express';
import { detectAnomaly } from '../services/TransactionService.js';
import { calculateFMI } from '../services/FMIService.js';
import { predictOverspend, detectLowBalanceRisk } from '../services/PredictionService.js';
import { applyRoundup, allocateToEnvelope, generateMicroActions } from '../services/MicroActionService.js';
import { generateResponse } from '../services/AgentService.js';
import { analyzeSentiment, annotateTransactions } from '../services/SentimentService.js';
import { detectBehavioralPatterns, calculateFIS, generateWeeklyReport } from '../services/BehaviorService.js';
import { smoothIncomeFlow } from '../services/IncomeFlowService.js';
import User        from '../models/User.js';
import Transaction from '../models/Transaction.js';
import FMIHistory  from '../models/FMIHistory.js';
import Alert       from '../models/Alert.js';
import Envelope    from '../models/Envelope.js';
import Income      from '../models/Income.js';
import Goal        from '../models/Goal.js';
import AgentMemory from '../models/AgentMemory.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────
function normalizeTransaction(tx) {
  return {
    id:          tx.id,
    userId:      tx.userId,
    amount:      tx.amount,
    category:    tx.category,
    sentiment:   tx.sentiment,
    sentimentScore: tx.sentimentScore,
    tags:        tx.tags || [],
    description: tx.description,
    timestamp:   tx.timestamp,
    isAnomaly:   tx.isAnomaly
  };
}

function normalizeFmi(item) {
  return { score: item.score, factors: item.factors, timestamp: item.timestamp };
}

const USER_ID = 'u1';

// ═══════════════════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════════════════

router.post('/user/register', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { email } = payload;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered. Please sign in or use a different email.' });
    }
    
    const doc = await User.create({ id: `u-${Date.now()}`, ...payload });
    res.status(201).json({ id: doc.id, name: doc.name, email: doc.email, incomeType: doc.incomeType, goals: doc.goals });
  } catch (error) { next(error); }
});

router.post('/user/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email not found. Please check your email or sign up.' });
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
    res.json({ id: user.id, name: user.name, email: user.email, incomeType: user.incomeType, goals: user.goals });
  } catch (error) { next(error); }
});

router.get('/user/profile', async (_req, res, next) => {
  try {
    const user = await User.findOne({ id: USER_ID }).lean();
    res.json(user);
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════

router.get('/transactions', async (_req, res, next) => {
  try {
    const txDocs  = await Transaction.find().sort({ timestamp: -1 }).lean();
    const txList  = txDocs.map(normalizeTransaction);
    const withAnomaly = detectAnomaly(txList);
    const annotated   = annotateTransactions(withAnomaly);
    res.json(annotated);
  } catch (error) { next(error); }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const { sentiment, tags } = analyzeSentiment(req.body.description, new Date());
    const tx = await Transaction.create({
      id:          `t-${Date.now()}`,
      userId:      USER_ID,
      amount:      req.body.amount,
      category:    req.body.category || 'shopping',
      sentiment:   req.body.sentiment || sentiment,
      sentimentScore: 0,
      tags:        tags,
      description: req.body.description || 'manual input',
      timestamp:   new Date()
    });
    res.status(201).json(normalizeTransaction(tx));
  } catch (error) { next(error); }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json(normalizeTransaction(updated));
  } catch (error) { next(error); }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const deleted = await Transaction.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// FMI
// ═══════════════════════════════════════════════════════════

router.get('/fmi', async (_req, res, next) => {
  try {
    const totalInc = (await Income.find({ userId: USER_ID }).lean()).reduce((s, i) => s + i.amount, 0);
    const txDocs = await Transaction.find({ userId: USER_ID }).sort({ timestamp: -1 }).lean();
    const totalExp = txDocs.reduce((s, t) => s + t.amount, 0);
    const currentBalance = totalInc - totalExp;

    const annotated = annotateTransactions(txDocs.slice(0, 20));
    const negativeRatio = annotated.length
      ? annotated.filter((t) => t.sentiment === 'negative').length / annotated.length
      : 0;
    const impulseRatio = annotated.length
      ? annotated.filter((t) => (t.tags || []).includes('impulse')).length / annotated.length
      : 0;

    // Derived factors
    const avgSpend = totalExp / (txDocs.length || 1);
    const deviation = txDocs.length > 1 
      ? Math.sqrt(txDocs.reduce((s, t) => s + Math.pow(t.amount - avgSpend, 2), 0) / txDocs.length) / (avgSpend || 1)
      : 0.5;

    const computed = calculateFMI({
      spendingDeviation: Math.min(1, deviation),
      sentimentScore:    1 - negativeRatio - impulseRatio * 0.5,
      upcomingBills:     0.4, // placeholder for bill tracking
      incomeStability:   0.8  // placeholder for income analysis
    });

    // Persist FMI snapshot
    await FMIHistory.create({
      score:     computed.score,
      factors:   computed.factors,
      timestamp: new Date()
    });

    res.json({ ...computed, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/fmi/history', async (_req, res, next) => {
  try {
    const history = await FMIHistory.find().sort({ timestamp: 1 }).lean();
    res.json(history.map(normalizeFmi));
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════

router.get('/alerts', async (_req, res, next) => {
  try {
    const txDocs = await Transaction.find({ userId: USER_ID }).sort({ timestamp: -1 }).lean();
    const incomes = await Income.find({ userId: USER_ID }).lean();
    const alerts = await Alert.find({ userId: USER_ID }).lean();

    const totalInc = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExp = txDocs.reduce((sum, tx) => sum + tx.amount, 0);
    const currentBalance = totalInc - totalExp;

    const recentSpending = txDocs.slice(0, 4).map((tx) => tx.amount);
    const overspend = predictOverspend(recentSpending, currentBalance);
    const lowBalance = detectLowBalanceRisk(currentBalance, totalInc * 0.2);

    const patterns = detectBehavioralPatterns(annotateTransactions(txDocs));
    const dynamic = [];

    if (overspend.risk === 'high') {
      dynamic.push({ id: `a-${Date.now()}-1`, userId: USER_ID, message: 'Spending trend is above your average this week.', type: 'nudge', severity: 'medium' });
    }
    if (lowBalance) {
      dynamic.push({ id: `a-${Date.now()}-2`, userId: USER_ID, message: 'Risk of low balance before next income date.', type: 'warning', severity: 'high' });
    }
    patterns.forEach((p, i) => {
      dynamic.push({ id: `a-${Date.now()}-p${i}`, userId: USER_ID, message: `${p.emoji} ${p.message}`, type: 'nudge', severity: p.severity });
    });

    res.json([...alerts, ...dynamic]);
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// ENVELOPES
// ═══════════════════════════════════════════════════════════

router.get('/envelopes', async (_req, res, next) => {
  try {
    const envelopes = await Envelope.findOne({ userId: USER_ID }).lean();
    res.json(envelopes);
  } catch (error) { next(error); }
});

router.get('/envelopes/roundup-preview', async (_req, res, next) => {
  try {
    const lastTx  = await Transaction.findOne().sort({ timestamp: -1 }).lean();
    if (!lastTx) return res.json({ amount: 0, previewText: 'No recent transactions to round up.' });
    
    // Default roundup algorithm (round up to nearest 50)
    const ceil50 = Math.ceil(lastTx.amount / 50) * 50;
    const roundup = ceil50 - lastTx.amount;
    const finalRoundup = roundup === 0 ? 50 : roundup;
    
    res.json({
      amount: finalRoundup,
      previewText: `Loose change from recent ₹${lastTx.amount} purchase`
    });
  } catch (error) { next(error); }
});

router.post('/envelopes/update', async (req, res, next) => {
  try {
    // If client passes an amount (e.g., they edited the preview), use it.
    // Otherwise fallback to 0.
    const customAmount = req.body.amount ? Number(req.body.amount) : 0;
    
    if (customAmount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be greater than 0.' });
    }

    const envelopes = await Envelope.findOne({ userId: USER_ID }).lean();
    const newSavings = (envelopes?.savings || 0) + customAmount;
    
    await Envelope.updateOne({ userId: USER_ID }, { $set: { savings: newSavings }});
    res.json({ message: `Successfully vaulted ₹${customAmount.toFixed(2)} into savings.` });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

router.get('/dashboard', async (_req, res, next) => {
  try {
    const txDocs = await Transaction.find({ userId: USER_ID }).sort({ timestamp: 1 }).lean();
    const incomes = await Income.find({ userId: USER_ID }).lean();
    const goals = await Goal.find({ userId: USER_ID }).lean();

    const currentFmi = await FMIHistory.findOne().sort({ timestamp: -1 }).lean();
    const fmiHistory = await FMIHistory.find().sort({ timestamp: 1 }).lean();
    const envelopes = await Envelope.findOne({ userId: USER_ID }).lean();

    const totalInc = incomes.reduce((s, i) => s + i.amount, 0);
    const totalExp = txDocs.reduce((s, t) => s + t.amount, 0);
    const currentBalance = totalInc - totalExp;

    const annotated = annotateTransactions(txDocs);
    const patterns = detectBehavioralPatterns(annotated);
    const recentSpending = txDocs.slice(-14).map((tx) => ({ amount: tx.amount, timestamp: tx.timestamp }));
    const overspendData = predictOverspend(recentSpending, envelopes?.savings || 0);
    const lowBalanceRisk = detectLowBalanceRisk(currentBalance, totalInc * 0.15, currentFmi?.score ?? 50);
    const microActions = generateMicroActions(currentFmi?.score ?? 50, overspendData);

    const fisData = calculateFIS(annotated, fmiHistory, envelopes);
    const totalIncome = totalInc;

    // Category Breakdown (last 30 days)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTx = txDocs.filter((t) => new Date(t.timestamp) > thirtyDaysAgo);
    const catMap = recentTx.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {});
    const totalRecentExp = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    const categoryBreakdown = Object.entries(catMap).map(([label, val]) => ({
      label,
      pct: Math.round((val / totalRecentExp) * 100)
    }));

    // Budget Metrics
    const budgetMetrics = [
      { label: 'Needs',   val: Math.round(totalRecentExp * 0.5), color: '#3B3BDE' },
      { label: 'Wants',   val: Math.round(totalRecentExp * 0.3), color: '#3B3BDE' },
      { label: 'Savings', val: envelopes?.savings || 0,        color: '#22C880' },
      { label: 'Invest',  val: goals.reduce((s, g) => s + g.savedAmount, 0), color: '#22C880' },
    ];

    // Dynamic Insights
    const insights = [];
    if (lowBalanceRisk) insights.push('High risk of low balance detected. Consider pausing non-essential spend.');
    if (overspendData.risk === 'high') insights.push('Your weekly spending trend is significantly above average.');
    
    patterns.slice(0, 2).forEach((p) => insights.push(p.message));
    
    if (insights.length < 3) {
      insights.push('Try one no-spend day in the next 48 hours.');
      insights.push('A small envelope shift can reduce end-of-week balance risk.');
    }

    res.json({
      fmiScore:      currentFmi?.score ?? 50,
      balance:       currentBalance,
      spendingSeries: txDocs.map((tx) => tx.amount),
      risk:          lowBalanceRisk ? 'high' : (overspendData.risk === 'high' ? 'high' : (currentFmi ? (currentFmi.score < 45 ? 'high' : (currentFmi.score < 70 ? 'medium' : 'low')) : 'medium')),
      insights:      insights.slice(0, 3),
      fis:           fisData.fis,
      fisGrade:      fisData.fisGrade,
      fisComponents: fisData.components,
      patterns,
      totalIncome,
      microActions,
      goals,
      categoryBreakdown,
      budgetMetrics
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// AGENT CHAT
// ═══════════════════════════════════════════════════════════

router.get('/agent/history', async (_req, res, next) => {
  try {
    const history = await AgentMemory.find({ userId: USER_ID }).sort({ timestamp: 1 }).lean();
    res.json(history.map((m) => ({
      id:        m._id.toString(),
      role:      m.role,
      content:   m.content,
      timestamp: m.timestamp
    })));
  } catch (error) { next(error); }
});

router.post('/agent/chat', async (req, res, next) => {
  try {
    const message = req.body.message || '';
    const fmi     = await FMIHistory.findOne().sort({ timestamp: -1 }).lean();
    const alerts  = await Alert.find().lean();
    const goals   = await Goal.find({ userId: USER_ID }).lean();
    const envelope = await Envelope.findOne({ userId: USER_ID }).lean();

    // Persist user message
    await AgentMemory.create({ userId: USER_ID, role: 'user', content: message });

    const response = await generateResponse(message, { fmi, alerts, goals, envelope });

    // Persist assistant response
    const saved = await AgentMemory.create({ userId: USER_ID, role: 'assistant', content: response });

    res.json({
      id:        saved._id.toString(),
      role:      'assistant',
      content:   response,
      timestamp: saved.timestamp.toISOString()
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════

router.get('/goals', async (_req, res, next) => {
  try {
    const goals = await Goal.find({ userId: USER_ID }).sort({ createdAt: 1 }).lean();
    res.json(goals);
  } catch (error) { next(error); }
});

router.post('/goals', async (req, res, next) => {
  try {
    const { name, emoji, targetAmount, targetDate, monthlyContribution } = req.body;
    const goal = await Goal.create({
      id:                  `g-${Date.now()}`,
      userId:              USER_ID,
      name,
      emoji:               emoji || '🎯',
      targetAmount:        Number(targetAmount),
      savedAmount:         0,
      targetDate:          targetDate || '',
      monthlyContribution: Number(monthlyContribution) || 0
    });
    res.status(201).json(goal);
  } catch (error) { next(error); }
});

router.put('/goals/:id', async (req, res, next) => {
  try {
    const { savedAmount, monthlyContribution, name, emoji, targetAmount, targetDate } = req.body;
    const update = {};
    if (savedAmount !== undefined)         update.savedAmount         = Number(savedAmount);
    if (monthlyContribution !== undefined) update.monthlyContribution = Number(monthlyContribution);
    if (name !== undefined)                update.name                = name;
    if (emoji !== undefined)               update.emoji               = emoji;
    if (targetAmount !== undefined)        update.targetAmount        = Number(targetAmount);
    if (targetDate !== undefined)          update.targetDate          = targetDate;
    const goal = await Goal.findOneAndUpdate({ id: req.params.id }, update, { new: true }).lean();
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (error) { next(error); }
});

router.delete('/goals/:id', async (req, res, next) => {
  try {
    await Goal.findOneAndDelete({ id: req.params.id });
    res.json({ message: 'Goal deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// INCOME
// ═══════════════════════════════════════════════════════════

router.get('/income', async (_req, res, next) => {
  try {
    const incomes = await Income.find({ userId: USER_ID }).sort({ timestamp: -1 }).lean();
    res.json(incomes);
  } catch (error) { next(error); }
});

router.post('/income', async (req, res, next) => {
  try {
    const { amount, source, description } = req.body;
    const income = await Income.create({
      id:          `i-${Date.now()}`,
      userId:      USER_ID,
      amount:      Number(amount),
      source:      source || 'salary',
      description: description || '',
      timestamp:   new Date()
    });
    res.status(201).json(income);
  } catch (error) { next(error); }
});

router.put('/income/:id', async (req, res, next) => {
  try {
    const { amount, source, description } = req.body;
    const update = {};
    if (amount !== undefined) update.amount = Number(amount);
    if (source !== undefined) update.source = source;
    if (description !== undefined) update.description = description;

    const income = await Income.findOneAndUpdate({ id: req.params.id }, update, { new: true }).lean();
    if (!income) return res.status(404).json({ message: 'Income not found' });
    res.json(income);
  } catch (error) { next(error); }
});

router.delete('/income/:id', async (req, res, next) => {
  try {
    const deleted = await Income.findOneAndDelete({ id: req.params.id }).lean();
    if (!deleted) return res.status(404).json({ message: 'Income not found' });
    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

router.get('/income/flow', async (_req, res, next) => {
  try {
    const incomes = await Income.find({ userId: USER_ID }).sort({ timestamp: 1 }).lean();
    const flow = smoothIncomeFlow(incomes);
    res.json(flow);
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// FINANCIAL INTEGRITY SCORE
// ═══════════════════════════════════════════════════════════

router.get('/fis', async (_req, res, next) => {
  try {
    const txDocs   = await Transaction.find().sort({ timestamp: -1 }).lean();
    const fmiHist  = await FMIHistory.find().sort({ timestamp: 1 }).lean();
    const envelope = await Envelope.findOne({ userId: USER_ID }).lean();
    const annotated = annotateTransactions(txDocs);
    const fisData = calculateFIS(annotated, fmiHist, envelope);
    res.json({ ...fisData, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// BEHAVIOR PATTERNS
// ═══════════════════════════════════════════════════════════

router.get('/behavior', async (_req, res, next) => {
  try {
    const txDocs = await Transaction.find().sort({ timestamp: -1 }).limit(50).lean();
    const annotated = annotateTransactions(txDocs);
    const patterns  = detectBehavioralPatterns(annotated);
    res.json({ patterns, analyzedCount: txDocs.length });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════

router.get('/reports/weekly', async (_req, res, next) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const txDocs   = await Transaction.find({ timestamp: { $gte: oneWeekAgo } }).sort({ timestamp: -1 }).lean();
    const fmiHist  = await FMIHistory.find({ timestamp: { $gte: oneWeekAgo } }).lean();
    const incomes  = await Income.find({ userId: USER_ID, timestamp: { $gte: oneWeekAgo } }).lean();
    const envelope = await Envelope.findOne({ userId: USER_ID }).lean();

    const annotated  = annotateTransactions(txDocs);
    const report     = generateWeeklyReport(annotated, fmiHist);
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const savingsRate = envelope && totalIncome > 0
      ? Math.round((envelope.savings / totalIncome) * 100)
      : 0;

    res.json({ ...report, totalIncome, savingsRate });
  } catch (error) { next(error); }
});

// ── Global error handler ─────────────────────────────────────
router.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

export default router;
