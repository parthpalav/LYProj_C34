const { Router } = require('express');
const { transactions, fmiHistory, alerts, user, envelopes } = require('../utils/mockData');
const { detectAnomaly } = require('../services/TransactionService');
const { calculateFMI } = require('../services/FMIService');
const { predictOverspend, detectLowBalanceRisk } = require('../services/PredictionService');
const { applyRoundup, allocateToEnvelope } = require('../services/MicroActionService');
const { generateResponse } = require('../services/AgentService');

const router = Router();

router.post('/user/register', (req, res) => {
  const payload = req.body || {};
  res.status(201).json({ id: 'u1', ...payload });
});

router.get('/user/profile', (_req, res) => {
  res.json(user);
});

router.get('/transactions', (_req, res) => {
  res.json(detectAnomaly(transactions));
});

router.post('/transactions', (req, res) => {
  const tx = {
    id: `t-${Date.now()}`,
    userId: 'u1',
    amount: req.body.amount,
    category: req.body.category || 'shopping',
    sentiment: req.body.sentiment || 'neutral',
    description: req.body.description || 'manual input',
    timestamp: new Date().toISOString()
  };
  transactions.push(tx);
  res.status(201).json(tx);
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

router.get('/fmi/history', (_req, res) => {
  res.json(fmiHistory);
});

router.post('/agent/chat', (req, res) => {
  const message = req.body.message || '';
  const fmi = fmiHistory[fmiHistory.length - 1];
  const response = generateResponse(message, { fmi, alerts });

  res.json({
    id: `m-${Date.now()}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString()
  });
});

router.get('/alerts', (_req, res) => {
  const recentSpending = transactions.slice(-4).map((tx) => tx.amount);
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
});

router.get('/envelopes', (_req, res) => {
  res.json(envelopes);
});

router.post('/envelopes/update', (_req, res) => {
  const lastTx = transactions[transactions.length - 1];
  const roundup = applyRoundup(lastTx);
  const updated = allocateToEnvelope(envelopes, roundup);

  envelopes.savings = updated.savings;

  res.json({
    message: `Applied roundup of INR ${roundup.toFixed(2)} to savings envelope.`
  });
});

router.get('/dashboard', (_req, res) => {
  const currentFmi = fmiHistory[fmiHistory.length - 1];
  res.json({
    fmiScore: currentFmi.score,
    balance: 12500,
    spendingSeries: transactions.map((tx) => tx.amount),
    risk: currentFmi.score < 45 ? 'high' : currentFmi.score < 70 ? 'medium' : 'low',
    insights: [
      'Food and shopping are currently driving spending deviation.',
      'A small envelope shift can reduce end-of-week balance risk.',
      'Try one no-spend day in the next 48 hours.'
    ]
  });
});

module.exports = router;
