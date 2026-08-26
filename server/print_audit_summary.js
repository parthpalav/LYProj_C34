import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync('./server/scratch_audit_results.json', 'utf8'));

function formatINR(val, compact = false) {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (compact) {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatPct(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  return `${(val * 100).toFixed(1)}%`;
}

console.log('=== 1. PERSONAS TABLE ===');
raw.personas.formattedResults.forEach((r, idx) => {
  console.log(`| ${idx + 1} | ${r.name} | ${formatINR(r.estimatedFire, true)} | ${r.userGoal ? formatINR(r.userGoal, true) : '—'} | ${formatINR(r.deterministicCorpus, true)} | ${formatPct(r.probFunded)} | ${formatINR(r.p10, true)} | ${formatINR(r.p50, true)} | ${formatINR(r.p90, true)} | ${r.fundedAge50} | ${r.fundedAge75} | ${formatINR(r.currentContrib)} | ${typeof r.recContrib === 'number' ? formatINR(r.recContrib) : r.recContrib} | ${typeof r.additionalContrib === 'number' ? formatINR(r.additionalContrib) : r.additionalContrib} | ${r.dataQuality} |`);
});

console.log('\n=== 2. COMPARATIVE INVARIANTS ===');
raw.invariants.forEach((inv, idx) => {
  console.log(`${idx + 1}. [${inv.passed ? 'PASS' : 'FAIL'}] ${inv.name} -> val1: ${inv.val1} | val2: ${inv.val2}`);
});

console.log('\n=== 3. RECONCILIATION ===');
raw.reconciliation.forEach((rec, idx) => {
  console.log(`${idx + 1}. ${rec.persona}: Deterministic=${formatINR(rec.detCorpus, true)} | ZeroVolP50=${formatINR(rec.zeroVolP50, true)} (Delta: ₹${rec.zeroVolDelta.toFixed(2)}) | ProdVolP50=${formatINR(rec.mcP50Prod, true)} (Delta: ${rec.prodVolPctDiff})`);
});

console.log('\n=== 4. SENSITIVITY SWEEPS ===');
console.log('--- Return Sweep ---');
console.table(raw.sensitivity.returnSweep);
console.log('--- Inflation Sweep ---');
console.table(raw.sensitivity.inflationSweep);
console.log('--- Contribution Sweep ---');
console.table(raw.sensitivity.contributionSweep);
console.log('--- Corpus Sweep ---');
console.table(raw.sensitivity.corpusSweep);
console.log('--- Horizon Sweep ---');
console.table(raw.sensitivity.horizonSweep);

console.log('\n=== 5. VOLATILITY POLICY ===');
console.table(raw.volatility);

console.log('\n=== 6. PERFORMANCE ===');
console.log(raw.performanceStats);
