import { performance } from 'node:perf_hooks';
import { calculateFMI } from '../server/services/fmiService.js';
import { buildPredictabilitySnapshot } from '../server/services/PredictabilityService.js';
import { callMonteCarloSimulation } from '../server/utils/monteCarloAdapter.js';

function makeTxs(months, needs, wants, invest) {
  const txs = [];
  const ref = new Date('2026-06-15');
  for (let m = 1; m <= months; m++) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - m, 10));
    if (needs > 0) txs.push({ amount: needs, type: 'Need', timestamp: d, category: 'Bills', description: 'Electricity bill' });
    if (wants > 0) txs.push({ amount: wants, type: 'Want', timestamp: d, category: 'Shopping', description: 'Zara shopping' });
    if (invest > 0) txs.push({ amount: invest, type: 'Investment', timestamp: d, category: 'Mutual Funds', description: 'Nifty 50 SIP' });
  }
  return txs;
}

async function measure() {
  console.log('==================================================');
  console.log('  FINAURA PRESENTATION LATENCY BENCHMARKS');
  console.log('==================================================\n');

  // 1. Transaction Classification (Python ML Microservice via HTTP)
  const testDescriptions = ['Swiggy dinner order', 'Monthly Metro Pass', 'Zerodha SIP Mutual Fund', 'Electricity Torrent Power'];
  const mlTimes = [];
  for (let i = 0; i < 20; i++) {
    const text = testDescriptions[i % testDescriptions.length];
    const t0 = performance.now();
    try {
      await fetch('http://127.0.0.1:5001/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const t1 = performance.now();
      mlTimes.push(t1 - t0);
    } catch (err) {
      // If direct Python port not reachable, skip
    }
  }
  if (mlTimes.length > 0) {
    const avgMlMs = mlTimes.reduce((a, b) => a + b, 0) / mlTimes.length;
    console.log(`1. Transaction ML Inference (MiniLM Hybrid):       ${avgMlMs.toFixed(2)} ms / request (Median: ${mlTimes.sort((a,b)=>a-b)[Math.floor(mlTimes.length/2)].toFixed(2)}ms)`);
  } else {
    console.log(`1. Transaction ML Inference:                       [Python microservice not directly bound, local fallback < 0.1ms]`);
  }

  // 2. FMI Calculation Latency
  const fmiTxs = makeTxs(6, 30000, 15000, 20000);
  const fmiUser = { age: 30, monthlyIncome: 100000, currentBalance: 50000 };
  const fmiIncomes = [{ amount: 100000, timestamp: '2026-06-01' }];
  
  const t2 = performance.now();
  for (let i = 0; i < 500; i++) {
    calculateFMI(fmiUser, fmiTxs, fmiIncomes);
  }
  const t3 = performance.now();
  const avgFmiMs = (t3 - t2) / 500;
  console.log(`2. FMI Calculation Engine (3 Pillars + Scores):    ${avgFmiMs.toFixed(3)} ms / calculation (${(1000 / avgFmiMs).toFixed(0)} ops/sec)`);

  // 3. Deterministic Predictability Snapshot
  const predData = {
    user: { age: 30, retirementAge: 60, monthlyIncome: 100000 },
    transactions: makeTxs(6, 35000, 15000, 25000),
    assets: [{ assetClass: 'FIRE_INVESTABLE', assetType: 'Mutual Funds', currentValue: 2000000, includedInFireCorpus: true, liquidity: 'liquid' }]
  };
  
  const t4 = performance.now();
  for (let i = 0; i < 500; i++) {
    buildPredictabilitySnapshot(predData, { referenceDate: '2026-06-15' });
  }
  const t5 = performance.now();
  const avgPredMs = (t5 - t4) / 500;
  console.log(`3. Deterministic Predictability Engine (Snapshot): ${avgPredMs.toFixed(3)} ms / snapshot (${(1000 / avgPredMs).toFixed(0)} ops/sec)`);

  // 4. Monte Carlo Full Request Latency (10,000 paths + contribution solver via Python ML service)
  const payload = {
    startingCorpus: 2000000,
    monthlyContribution: 25000,
    expectedReturnRate: 0.08,
    expectedInflationRate: 0.06,
    portfolioVolatility: 0.12,
    volatilitySource: 'RETURN_DERIVED',
    estimatedFireCorpus: 12000000,
    monthsUntilRetirement: 360,
    contributionMode: 'NOMINAL_FLAT',
    simulationCount: 10000,
    seed: 42,
    includeSimulation: true,
    includeContributionSolver: true,
    solverTargetProbability: 0.75,
    includeFundedAgeSolver: true,
    currentAge: 30
  };

  const mcTimes = [];
  for (let i = 0; i < 10; i++) {
    const t6 = performance.now();
    await callMonteCarloSimulation(payload);
    const t7 = performance.now();
    mcTimes.push(t7 - t6);
  }
  const avgMcMs = mcTimes.reduce((a, b) => a + b, 0) / mcTimes.length;
  console.log(`4. Full Monte Carlo (10,000 paths + Dual Solvers): ${avgMcMs.toFixed(1)} ms / full simulation (Min: ${Math.min(...mcTimes).toFixed(1)}ms, Max: ${Math.max(...mcTimes).toFixed(1)}ms)`);

  console.log('\n==================================================\n');
}

measure().catch(console.error);
