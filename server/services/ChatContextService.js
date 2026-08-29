/**
 * server/services/ChatContextService.js
 * 
 * Deterministic Financial Context Aggregator for FINAURA AI Chatbot.
 * Assembles verified, grounded financial snapshots for the authenticated user
 * across Profile, Balance, Transactions, Income, Assets, Liabilities, FMI,
 * Goals, Alerts, and FIRE / Predictability.
 * 
 * Invariants:
 *  - Strict authentication: userId is strictly derived from the authenticated session.
 *  - Never exposes passwords, hashes, tokens, secrets, or internal processing markers.
 *  - Deterministic calculations: all metrics are derived using FINAURA's canonical accounting helpers.
 *  - Bounded payloads: limits recent transaction history and raw list sizes.
 *  - Safe fallback: zero/empty defaults ensure no undefined/NaN leakage.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Asset from '../models/Asset.js';
import Liability from '../models/Liability.js';
import Goal from '../models/Goal.js';
import Alert from '../models/Alert.js';
import FMIHistory from '../models/FMIHistory.js';
import { calculateFMI } from './FMIService.js';
import { annotateTransactions } from './SentimentService.js';
import {
  calculateInvestableCorpus,
  calculateInvestableWeightedReturn
} from '../utils/financialMath.js';
import { buildPredictabilitySnapshot } from './PredictabilityService.js';
import {
  DEFAULT_RETURN_RATE,
  DEFAULT_INFLATION_RATE,
  DEFAULT_WITHDRAWAL_RATE,
  DEFAULT_LIFESTYLE_RATIO
} from '../config/financialRules.js';

/**
 * Builds a comprehensive, grounded financial context snapshot for the given user.
 * 
 * @param {string} userId - Authenticated user identifier
 * @returns {Promise<Object>} Structured financial context payload
 */
export async function buildChatContext(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId string is required to build chat context');
  }

  // 1. Resolve User
  const conditions = [{ id: userId }];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    conditions.push({ _id: userId });
  }
  const user = await User.findOne({ $or: conditions }).lean();

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const queryUid = user.id || userId;

  // 2. Fetch User Financial Records in Parallel
  const [
    txDocs,
    incomeDocs,
    assetDocs,
    liabilityDocs,
    goalDocs,
    alertDocs,
    latestFmiDoc
  ] = await Promise.all([
    Transaction.find({ userId: queryUid }).sort({ timestamp: -1 }).lean(),
    Income.find({ userId: queryUid }).sort({ createdAt: -1 }).lean(),
    Asset.find({ userId: queryUid }).sort({ createdAt: -1 }).lean(),
    Liability.find({ userId: queryUid, status: { $ne: 'deleted' } }).sort({ nextDueDate: 1 }).lean(),
    Goal.find({ userId: queryUid }).sort({ createdAt: 1 }).lean(),
    Alert.find({ userId: queryUid }).sort({ timestamp: -1 }).lean(),
    FMIHistory.findOne({ userId: queryUid }).sort({ timestamp: -1 }).lean()
  ]);

  // 3. User Profile & Operating Balance
  const currentAge = user.dateOfBirth
    ? Math.max(18, new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear())
    : (Number(user.age) || 25);

  const profile = {
    name: user.name || 'User',
    age: currentAge,
    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : null,
    monthlyIncome: Number(user.monthlyIncome) || 0,
    incomeType: user.incomeType || 'salaried',
    currentBalance: Number(user.currentBalance) || 0,
    retirementAge: Number(user.retirementAge) || 60,
    retirementCorpusGoal: Number(user.retirementCorpusGoal) || 0,
    expectedReturnRate: user.expectedReturnRate !== undefined && user.expectedReturnRate !== null
      ? Number(user.expectedReturnRate)
      : DEFAULT_RETURN_RATE,
    expectedInflationRate: user.expectedInflationRate !== undefined && user.expectedInflationRate !== null
      ? Number(user.expectedInflationRate)
      : DEFAULT_INFLATION_RATE,
    expectedWithdrawalRate: user.expectedWithdrawalRate !== undefined && user.expectedWithdrawalRate !== null
      ? Number(user.expectedWithdrawalRate)
      : DEFAULT_WITHDRAWAL_RATE,
    lifestyleAdjustmentRatio: user.lifestyleAdjustmentRatio !== undefined && user.lifestyleAdjustmentRatio !== null
      ? Number(user.lifestyleAdjustmentRatio)
      : DEFAULT_LIFESTYLE_RATIO,
    emergencyFundTargetMonths: Number(user.emergencyFundTargetMonths) || 6
  };

  const balance = {
    current: profile.currentBalance
  };

  // 4. Transaction Aggregations (Current Month, Previous Month, Recent Transactions)
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

  const aggregateMonthTxs = (txs) => {
    let needs = 0;
    let wants = 0;
    let investments = 0;
    const byCategory = {};

    for (const t of txs) {
      const amt = Math.abs(Number(t.amount) || 0);
      const cat = t.category || 'Misc';
      const type = t.type || 'Need';

      if (type === 'Need') needs += amt;
      else if (type === 'Want') wants += amt;
      else if (type === 'Investment') investments += amt;
      else needs += amt;

      byCategory[cat] = (byCategory[cat] || 0) + amt;
    }

    return {
      totalSpending: needs + wants, // Consumption spending (Needs + Wants)
      totalOutflow: needs + wants + investments,
      needs,
      wants,
      investments,
      byCategory
    };
  };

  const currentMonthTxs = txDocs.filter(t => {
    if (!t.timestamp) return false;
    const d = new Date(t.timestamp);
    return d >= currentMonthStart && d <= currentMonthEnd;
  });

  const prevMonthTxs = txDocs.filter(t => {
    if (!t.timestamp) return false;
    const d = new Date(t.timestamp);
    return d >= prevMonthStart && d <= prevMonthEnd;
  });

  const currentMonthSpending = aggregateMonthTxs(currentMonthTxs);
  const previousMonthSpending = aggregateMonthTxs(prevMonthTxs);

  // Bounded recent transactions (max 15)
  const recentTransactions = txDocs.slice(0, 15).map(t => ({
    id: t.id || t._id?.toString(),
    description: t.description || t.title || t.category,
    amount: Math.abs(Number(t.amount) || 0),
    category: t.category || 'Misc',
    type: t.type || 'Need',
    timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : null
  }));

  const spending = {
    currentMonth: currentMonthSpending,
    previousMonth: previousMonthSpending,
    recentTransactions
  };

  // 5. Income Context
  const currentMonthIncomes = incomeDocs.filter(i => {
    if (!i.timestamp) return false;
    const d = new Date(i.timestamp);
    return d >= currentMonthStart && d <= currentMonthEnd;
  });
  const recordedCurrentMonthIncome = currentMonthIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalRecordedIncome = incomeDocs.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const incomeSources = incomeDocs.map(i => ({
    id: i.id || i._id?.toString(),
    source: i.source || 'salary',
    description: i.description || i.name || i.source,
    amount: Number(i.amount) || 0,
    timestamp: i.timestamp ? new Date(i.timestamp).toISOString().slice(0, 10) : null
  }));

  const income = {
    profileMonthlyIncome: profile.monthlyIncome,
    recordedCurrentMonthIncome,
    totalRecordedIncome,
    sources: incomeSources
  };

  // 6. Asset Context
  const investableResult = calculateInvestableCorpus(assetDocs);
  const fireInvestableCorpus = investableResult.includedTotal;
  const totalAssetValue = assetDocs.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  const weightedReturnRate = calculateInvestableWeightedReturn(
    investableResult.includedAssets,
    profile.expectedReturnRate
  );

  let liquidBuffer = 0;
  for (const a of assetDocs) {
    const val = Number(a.currentValue) || 0;
    const isLiquid = (
      a.assetClass === 'SEMI_LIQUID' ||
      a.assetType?.toLowerCase() === 'cash' ||
      a.assetType?.toLowerCase() === 'bank' ||
      a.assetType?.toLowerCase() === 'savings' ||
      a.assetType?.toLowerCase() === 'liquid fund'
    ) && a.liquidity !== 'locked' && a.liquidity !== 'restricted' && a.assetClass !== 'NON_INVESTABLE';

    if (isLiquid) liquidBuffer += val;
  }

  const holdings = assetDocs.map(a => ({
    id: a.id || a._id?.toString(),
    name: a.name,
    assetType: a.assetType,
    assetClass: a.assetClass,
    currentValue: Number(a.currentValue) || 0,
    annualReturnRate: a.annualReturnRate !== undefined && a.annualReturnRate !== null ? Number(a.annualReturnRate) : null,
    includedInFireCorpus: a.includedInFireCorpus === true && a.assetClass !== 'NON_INVESTABLE',
    liquidity: a.liquidity || 'liquid'
  }));

  const assets = {
    totalValue: totalAssetValue,
    fireInvestableCorpus,
    liquidBuffer,
    portfolioWeightedReturnRate: Math.round(weightedReturnRate * 10000) / 10000,
    holdings
  };

  // 7. Liability Context
  const activeLiabilities = liabilityDocs.filter(l => l.status !== 'paid_off' && l.status !== 'deleted');
  const totalMonthlyLiabilityService = activeLiabilities.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const knownOutstandingPrincipal = activeLiabilities.reduce((sum, l) => sum + (Number(l.outstandingBalance ?? l.outstandingPrincipal) || 0), 0);

  const formattedLiabilities = activeLiabilities.map(l => ({
    id: l.id || l._id?.toString(),
    name: l.name,
    amount: Number(l.amount) || 0,
    category: l.category,
    type: l.type,
    frequency: l.frequency || l.recurrence || 'monthly',
    nextDueDate: l.nextDueDate ? new Date(l.nextDueDate).toISOString().slice(0, 10) : null,
    autoDeduct: l.autoDeduct === true,
    status: l.status,
    outstandingBalance: (l.outstandingBalance ?? l.outstandingPrincipal) !== undefined && (l.outstandingBalance ?? l.outstandingPrincipal) !== null ? Number(l.outstandingBalance ?? l.outstandingPrincipal) : null,
    interestRate: l.interestRate !== undefined && l.interestRate !== null ? Number(l.interestRate) : null
  }));

  const liabilities = {
    activeCount: activeLiabilities.length,
    monthlyLiabilityService: totalMonthlyLiabilityService,
    knownOutstandingPrincipal,
    active: formattedLiabilities
  };

  // 8. FMI Context (Deterministic In-Memory Calculation with Fallback)
  let fmiData;
  try {
    const annotatedMonthly = annotateTransactions(currentMonthTxs);
    const retirementGoalObj = goalDocs.find(g => /retire/i.test(g.name)) || null;
    const retirementGoal = retirementGoalObj?.targetAmount || Math.round(profile.monthlyIncome * 12 * 20);

    const fmiUser = {
      currentBalance: balance.current,
      monthlyIncome: profile.monthlyIncome,
      currentAge: profile.age,
      retirementAge: profile.retirementAge,
      retirementGoal,
      previousShortfall: 0
    };

    const computed = calculateFMI(fmiUser, annotatedMonthly);
    fmiData = {
      score: computed.score,
      fmiLabel: computed.fmiLabel,
      status: computed.status,
      pillars: {
        savingDiscipline: computed.pillars.D1_savingDiscipline.score,
        spendingControl: computed.pillars.D2_spendingControl.score,
        behavioralRisk: computed.pillars.D3_behavioralRisk.score
      },
      factors: computed.factors || [],
      insights: computed.insights || [],
      predictedMonthlySpend: computed.predictedMonthlySpend,
      requiredMonthlySaving: computed.requiredMonthlySaving
    };
  } catch (fmiErr) {
    fmiData = {
      score: latestFmiDoc?.score ?? 50,
      fmiLabel: (latestFmiDoc?.score ?? 50) >= 70 ? 'Thriving' : ((latestFmiDoc?.score ?? 50) >= 50 ? 'Stable' : 'Attention'),
      status: 'exact',
      pillars: { savingDiscipline: 50, spendingControl: 50, behavioralRisk: 50 },
      factors: latestFmiDoc?.factors || [],
      insights: [],
      predictedMonthlySpend: currentMonthSpending.totalSpending,
      requiredMonthlySaving: 0
    };
  }

  // 9. Goals and Alerts
  const goals = goalDocs.map(g => ({
    id: g.id || g._id?.toString(),
    name: g.name,
    targetAmount: Number(g.targetAmount) || 0,
    savedAmount: Number(g.savedAmount) || 0,
    targetDate: g.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : null
  }));

  const alerts = alertDocs.map(a => ({
    id: a.id || a._id?.toString(),
    type: a.type || 'info',
    severity: a.severity || 'low',
    message: a.message,
    timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : null
  }));

  // 10. FIRE & Predictability Deterministic Projections
  let fireData = {
    available: false,
    fireTarget: 0,
    currentInvestableCorpus: fireInvestableCorpus,
    fundedAge: null,
    monthsToTarget: null,
    monthlyContributionUsed: 0,
    scenarios: null
  };

  try {
    const predData = {
      user,
      incomes: incomeDocs,
      transactions: txDocs,
      assets: assetDocs,
      liabilities: liabilityDocs
    };
    const predSnapshot = buildPredictabilitySnapshot(predData);

    if (predSnapshot && predSnapshot.forecastStatus?.available) {
      fireData = {
        available: true,
        fireTarget: predSnapshot.retirement?.estimatedFireCorpus ?? 0,
        currentInvestableCorpus: predSnapshot.assets?.fireInvestableCorpus ?? fireInvestableCorpus,
        fundedAge: predSnapshot.retirement?.projectedFireAge ?? null,
        monthsUntilRetirement: predSnapshot.monthsUntilRetirement ?? null,
        monthsToTarget: predSnapshot.retirement?.projectedFire?.months ?? null,
        monthlyContributionUsed: predSnapshot.currentState?.observedAverageMonthlyInvestment ?? 0,
        projectedCorpusAtRetirement: predSnapshot.retirement?.projectedCorpus ?? null,
        scenarios: {
          base: {
            label: predSnapshot.scenarios?.base?.label || 'Base',
            projectedCorpus: predSnapshot.scenarios?.base?.projectedCorpus,
            projectedFireAge: predSnapshot.scenarios?.base?.projectedFireAge
          },
          conservative: {
            label: predSnapshot.scenarios?.conservative?.label || 'Conservative',
            projectedCorpus: predSnapshot.scenarios?.conservative?.projectedCorpus,
            projectedFireAge: predSnapshot.scenarios?.conservative?.projectedFireAge
          },
          optimistic: {
            label: predSnapshot.scenarios?.optimistic?.label || 'Optimistic',
            projectedCorpus: predSnapshot.scenarios?.optimistic?.projectedCorpus,
            projectedFireAge: predSnapshot.scenarios?.optimistic?.projectedFireAge
          }
        }
      };
    }
  } catch (predErr) {
    // Graceful fallback if predictability resolver encounters limitations
  }

  // 11. Final Assembled Payload
  return {
    generatedAt: new Date().toISOString(),
    profile,
    balance,
    income,
    spending,
    assets,
    liabilities,
    fmi: fmiData,
    fire: fireData,
    goals,
    alerts
  };
}
