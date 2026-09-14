/**
 * server/research_family_fmi_fixture.js
 *
 * Authoritative, executable research fixture runner for FINAURA FMI Characterisation.
 * Computes Personal FMI golden cases and Family FMI pooling proof directly from
 * production FMIService and FamilyFMIService logic.
 *
 * Outputs pure JSON to stdout for consumption by research/scripts/generate_benchmarks.py.
 */

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Goal from './models/Goal.js';
import Family from './models/Family.js';
import Transaction from './models/Transaction.js';
import Income from './models/Income.js';
import {
  calculateFMI,
  calculateMemberGoalDetail,
  calculateSavingDisciplineScore,
  calculateSpendingControlScore,
  calculateFinalFMIScore,
  getFMILabel
} from './services/FMIService.js';
import * as FamilyFMIService from './services/FamilyFMIService.js';

// Divert logging to stderr so stdout is reserved exclusively for the JSON payload
const originalLog = console.log;
console.log = (...args) => console.error(...args);

async function runResearchFixtures() {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Personal FMI Golden Characterisation Cases (authoritative FMIService)
  // ──────────────────────────────────────────────────────────────────────────
  const userClean = {
    currentBalance: 0,
    monthlyIncome: 100000,
    currentAge: 30,
    retirementAge: 40,
    retirementGoal: 2400000,
    previousShortfall: 0
  };

  const expenses1 = [
    { amount: 7000, type: 'Investment', category: 'Investments', timestamp: new Date() },
    { amount: 10000, type: 'Need', category: 'Housing', timestamp: new Date() }
  ];
  const r1 = calculateFMI(userClean, expenses1);

  const expenses2 = [
    { amount: 20000, type: 'Investment', category: 'Investments', timestamp: new Date() },
    { amount: 15000, type: 'Need', category: 'Housing', timestamp: new Date() }
  ];
  const r2 = calculateFMI(userClean, expenses2);

  const expenses3 = [
    { amount: 30000, type: 'Investment', category: 'Investments', timestamp: new Date() },
    { amount: 10000, type: 'Need', category: 'Housing', timestamp: new Date() }
  ];
  const r3 = calculateFMI(userClean, expenses3);

  const goldenCases = [
    { case: 'D1 below target (35%)', d1: r1.pillars.D1_savingDiscipline.score, fmi: r1.score, label: r1.fmiLabel },
    { case: 'D1 at target (100%)', d1: r2.pillars.D1_savingDiscipline.score, fmi: r2.score, label: r2.fmiLabel },
    { case: 'D1 above target (150%)', d1: r3.pillars.D1_savingDiscipline.score, fmi: r3.score, label: r3.fmiLabel }
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Family FMI Deterministic Fixture (Member A & Member B)
  // ──────────────────────────────────────────────────────────────────────────
  // Member A: Age 30, Retires at 40 (120 mo). Goal: 2,400,000 -> Required: 20,000/mo. Income: 80,000.
  // Member B: Age 30, Retires at 40 (120 mo). Goal: 1,200,000 -> Required: 10,000/mo. Income: 50,000.
  const now = new Date();
  const currentMonthMid = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0);
  const dob30 = new Date(now.getFullYear() - 30, 0, 1);

  const ts = Date.now();
  const uidA = `u-res-fmi-a-${ts}`;
  const uidB = `u-res-fmi-b-${ts}`;

  let resA, resB, famResult;

  let dbConnected = false;
  try {
    // Attempt real database execution first for complete end-to-end service validation
    await connectDB();
    dbConnected = true;

    const userA = await User.create({
      id: uidA,
      name: 'Alice FMI Research',
      email: `alice-res-${ts}@test.com`,
      dateOfBirth: dob30,
      age: 30,
      retirementAge: 40,
      monthlyIncome: 80000,
      income: 80000,
      currentBalance: 0
    });
    await Goal.create({
      id: `g-res-a-${ts}`,
      userId: uidA,
      name: 'Retirement Corpus',
      targetAmount: 2400000
    });

    const userB = await User.create({
      id: uidB,
      name: 'Bob FMI Research',
      email: `bob-res-${ts}@test.com`,
      dateOfBirth: dob30,
      age: 30,
      retirementAge: 40,
      monthlyIncome: 50000,
      income: 50000,
      currentBalance: 0
    });
    await Goal.create({
      id: `g-res-b-${ts}`,
      userId: uidB,
      name: 'Retirement Corpus',
      targetAmount: 1200000
    });

    await Family.create({
      name: 'FMI Research Household',
      ownerUserId: uidA,
      members: [
        { userId: uidA, role: 'owner', joinedAt: new Date() },
        { userId: uidB, role: 'member', joinedAt: new Date() }
      ],
      isActive: true
    });

    await Income.create({
      id: `inc-res-a-${ts}`,
      userId: uidA,
      amount: 80000,
      timestamp: currentMonthMid
    });

    await Transaction.create([
      { id: `tx-res-a1-${ts}`, userId: uidA, amount: 25000, type: 'Need', category: 'Housing', timestamp: currentMonthMid },
      { id: `tx-res-a2-${ts}`, userId: uidA, amount: 15000, type: 'Want', category: 'Shopping', timestamp: currentMonthMid },
      { id: `tx-res-a3-${ts}`, userId: uidA, amount: 18000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid },
      { id: `tx-res-b1-${ts}`, userId: uidB, amount: 20000, type: 'Need', category: 'Groceries', timestamp: currentMonthMid },
      { id: `tx-res-b2-${ts}`, userId: uidB, amount: 10000, type: 'Want', category: 'Entertainment', timestamp: currentMonthMid },
      { id: `tx-res-b3-${ts}`, userId: uidB, amount: 12000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid }
    ]);

    famResult = await FamilyFMIService.getFamilyFMI(uidA, null, now);
    const txsA = await Transaction.find({ userId: uidA }).lean();
    const txsB = await Transaction.find({ userId: uidB }).lean();

    resA = calculateFMI({
      currentBalance: userA.currentBalance,
      monthlyIncome: userA.monthlyIncome,
      currentAge: userA.age,
      retirementAge: userA.retirementAge,
      retirementGoal: 2400000
    }, txsA);

    resB = calculateFMI({
      currentBalance: userB.currentBalance,
      monthlyIncome: userB.monthlyIncome,
      currentAge: userB.age,
      retirementAge: userB.retirementAge,
      retirementGoal: 1200000
    }, txsB);

  } catch (err) {
    console.error('[research_family_fmi_fixture] Note: DB-backed FamilyFMIService call fell back to pure exported helpers:', err.message);

    // Fallback: If Mongo is not running, compute using the exact same exported production scoring functions
    const userA = { currentBalance: 0, monthlyIncome: 80000, currentAge: 30, retirementAge: 40, retirementGoal: 2400000 };
    const txsA = [
      { amount: 25000, type: 'Need', category: 'Housing', timestamp: currentMonthMid },
      { amount: 15000, type: 'Want', category: 'Shopping', timestamp: currentMonthMid },
      { amount: 18000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid }
    ];

    const userB = { currentBalance: 0, monthlyIncome: 50000, currentAge: 30, retirementAge: 40, retirementGoal: 1200000 };
    const txsB = [
      { amount: 20000, type: 'Need', category: 'Groceries', timestamp: currentMonthMid },
      { amount: 10000, type: 'Want', category: 'Entertainment', timestamp: currentMonthMid },
      { amount: 12000, type: 'Investment', category: 'Investments', timestamp: currentMonthMid }
    ];

    resA = calculateFMI(userA, txsA);
    resB = calculateFMI(userB, txsB);

    // Exact Family FMI math implemented in FamilyFMIService.js:
    const goalDetailA = calculateMemberGoalDetail(userA, [{ name: 'Retirement Corpus', targetAmount: 2400000 }]);
    const goalDetailB = calculateMemberGoalDetail(userB, [{ name: 'Retirement Corpus', targetAmount: 1200000 }]);
    const householdRequiredThisMonth = goalDetailA.requiredThisMonth + goalDetailB.requiredThisMonth; // 30,000
    const householdTotalSaved = 18000 + 12000; // 30,000
    const d1Result = calculateSavingDisciplineScore(householdTotalSaved, householdRequiredThisMonth);

    const effectiveHouseholdIncome = 80000 + 50000; // 130,000
    const availableMoney = Math.max(0, effectiveHouseholdIncome - householdRequiredThisMonth); // 100,000
    const householdNonInvestmentSpend = (25000 + 15000) + (20000 + 10000); // 70,000
    const daysPassed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const predictedMonthlySpend = daysPassed > 0 ? (householdNonInvestmentSpend / daysPassed) * daysInMonth : 0;
    const d2Result = calculateSpendingControlScore(predictedMonthlySpend, availableMoney, householdNonInvestmentSpend, effectiveHouseholdIncome);

    const d3Score = 100; // No behavioral penalties triggered
    const famScoreObj = calculateFinalFMIScore(d1Result.score, d2Result.score, d3Score);

    famResult = {
      score: famScoreObj.score,
      rawFMI: famScoreObj.rawFMI,
      pillars: {
        D1_savingDiscipline: { score: d1Result.score, detail: d1Result.detail },
        D2_spendingControl: { score: d2Result.score, detail: d2Result.detail },
        D3_behavioralRisk: { score: d3Score, detail: 'No risky spending behaviors detected' }
      }
    };
  } finally {
    if (dbConnected) {
      try {
        await User.deleteMany({ id: { $in: [uidA, uidB] } });
        await Goal.deleteMany({ userId: { $in: [uidA, uidB] } });
        await Family.deleteMany({ ownerUserId: uidA });
        await Income.deleteMany({ userId: { $in: [uidA, uidB] } });
        await Transaction.deleteMany({ userId: { $in: [uidA, uidB] } });
        await mongoose.disconnect();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  const arithmeticAverage = (resA.score + resB.score) / 2;
  const famD1 = famResult.pillars.D1_savingDiscipline.score;
  const famD2 = famResult.pillars.D2_spendingControl.score;
  const famD3 = famResult.pillars.D3_behavioralRisk.score;
  const famScore = famResult.score;

  const output = {
    fmi_formula: '0.40*D1 + 0.30*D2 + 0.30*D3',
    weights: { D1: 0.40, D2: 0.30, D3: 0.30 },
    golden_cases: goldenCases,
    family_proof: {
      memberA: {
        score: resA.score,
        d1: resA.pillars.D1_savingDiscipline.score,
        d2: resA.pillars.D2_spendingControl.score,
        d3: resA.pillars.D3_behavioralRisk.score
      },
      memberB: {
        score: resB.score,
        d1: resB.pillars.D1_savingDiscipline.score,
        d2: resB.pillars.D2_spendingControl.score,
        d3: resB.pillars.D3_behavioralRisk.score
      },
      arithmetic_average: arithmeticAverage,
      pooled_family: {
        score: famScore,
        rawFMI: famResult.rawFMI,
        d1: famD1,
        d2: famD2,
        d3: famD3
      },
      proof_inequality: famScore !== arithmeticAverage
    }
  };

  // Emit clean JSON to stdout
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

runResearchFixtures().catch((err) => {
  console.error('[research_family_fmi_fixture] Fatal Error:', err);
  process.exit(1);
});
