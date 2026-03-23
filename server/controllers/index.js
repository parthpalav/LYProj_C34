const { Router } = require('express');
const { detectAnomaly } = require('../services/TransactionService');
const { calculateFMI } = require('../services/FMIService');
const { predictOverspend, detectLowBalanceRisk } = require('../services/PredictionService');
const { applyRoundup, allocateToEnvelope } = require('../services/MicroActionService');
const { generateResponse } = require('../services/AgentService');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const FMIHistory = require('../models/FMIHistory');
const Alert = require('../models/Alert');
const Envelope = require('../models/Envelope');

const router = Router();

function normalizeTransaction(tx) {
  return {
    id: tx.id,
    userId: tx.userId,
    amount: tx.amount,
    category: tx.category,
    sentiment: tx.sentiment,
    description: tx.description,
    timestamp: tx.timestamp
  };
}

function normalizeFmi(item) {
  return {
    score: item.score,
    factors: item.factors,
    timestamp: item.timestamp
  };
}

router.post('/user/register', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const doc = await User.create({ id: `u-${Date.now()}`, ...payload });
    res.status(201).json({
      id: doc.id,
      name: doc.name,
      incomeType: doc.incomeType,
      goals: doc.goals
    });
  } catch (error) {
    next(error);
  }
});

router.get('/user/profile', async (_req, res, next) => {
  try {
    const user = await User.findOne({ id: 'u1' }).lean();
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', async (_req, res, next) => {
  try {
    const txDocs = await Transaction.find().sort({ timestamp: 1 }).lean();
    const txList = txDocs.map(normalizeTransaction);
    res.json(detectAnomaly(txList));
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const tx = await Transaction.create({
      id: `t-${Date.now()}`,
      userId: 'u1',
      amount: req.body.amount,
      category: req.body.category || 'shopping',
      sentiment: req.body.sentiment || 'neutral',
      description: req.body.description || 'manual input',
      timestamp: new Date()
    });

    res.status(201).json(normalizeTransaction(tx));
  } catch (error) {
    next(error);
  }
});

router.get('/fmi', (_req, res) => {
  const computed = calculateFMI({
    spendingDeviation: 0.62,
    sentimentScore: 0.46,
    upcomingBills: 0.58,
    incomeStability: 0.8
  });
  res.json({ ...computed, timestamp: new Date().toISOString() });
});

router.get('/fmi/history', async (_req, res, next) => {
  try {
    const history = await FMIHistory.find().sort({ timestamp: 1 }).lean();
    res.json(history.map(normalizeFmi));
  } catch (error) {
    next(error);
  }
});

router.post('/agent/chat', async (req, res, next) => {
  try {
    const message = req.body.message || '';
    const fmi = await FMIHistory.findOne().sort({ timestamp: -1 }).lean();
    const alerts = await Alert.find().lean();
    const response = generateResponse(message, { fmi, alerts });

    res.json({
      id: `m-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', async (_req, res, next) => {
  try {
    const txDocs = await Transaction.find().sort({ timestamp: 1 }).lean();
    const alerts = await Alert.find().lean();

    const recentSpending = txDocs.slice(-4).map((tx) => tx.amount);
    const overspend = predictOverspend({ recentSpending });
    const lowBalance = detectLowBalanceRisk(12500, 9800);

    const dynamic = [];
    if (overspend) {
      dynamic.push({
        id: `a-${Date.now()}-1`,
        userId: 'u1',
        message: 'Spending trend is above your average this week.',
        type: 'nudge',
        severity: 'medium'
      });
    }

    if (lowBalance) {
      dynamic.push({
        id: `a-${Date.now()}-2`,
        userId: 'u1',
        message: 'Risk of low balance before next income date.',
        type: 'warning',
        severity: 'high'
      });
    }

    res.json([...alerts, ...dynamic]);
  } catch (error) {
    next(error);
  }
});

router.get('/envelopes', async (_req, res, next) => {
  try {
    const envelopes = await Envelope.findOne({ userId: 'u1' }).lean();
    res.json(envelopes);
  } catch (error) {
    next(error);
  }
});

router.post('/envelopes/update', async (_req, res, next) => {
  try {
    const lastTx = await Transaction.findOne().sort({ timestamp: -1 }).lean();
    const envelopes = await Envelope.findOne({ userId: 'u1' }).lean();

    const roundup = applyRoundup(lastTx || { amount: 0 });
    const updated = allocateToEnvelope(envelopes, roundup);

    await Envelope.updateOne({ userId: 'u1' }, { savings: updated.savings });

    res.json({
      message: `Applied roundup of INR ${roundup.toFixed(2)} to savings envelope.`
    });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const currentFmi = await FMIHistory.findOne().sort({ timestamp: -1 }).lean();
    const txDocs = await Transaction.find().sort({ timestamp: 1 }).lean();

    res.json({
      fmiScore: currentFmi.score,
      balance: 12500,
      spendingSeries: txDocs.map((tx) => tx.amount),
      risk: currentFmi.score < 45 ? 'high' : currentFmi.score < 70 ? 'medium' : 'low',
      insights: [
        'Food and shopping are currently driving spending deviation.',
        'A small envelope shift can reduce end-of-week balance risk.',
        'Try one no-spend day in the next 48 hours.'
      ]
    });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = router;
