import { buildBaseline } from './baselineService.js';

const STRESS_WORDS = ['urgent', 'loan', 'help', 'please', 'due', 'overdue', 'borrow', 'emergency'];
const POSITIVE_WORDS = ['celebrate', 'gift', 'vacation', 'bonus', 'saved', 'discount'];
const PRO_WORDS = ['client', 'meeting', 'office', 'tools', 'reimbursement'];

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function bandFor(score) {
  if (score <= 34) return 'High Distress';
  if (score <= 54) return 'Mild Stress';
  if (score <= 79) return 'Stable';
  return 'High Confidence';
}

export function computeFmi({ user, expenses = [], currentBalance = 0, previousFmi }) {
  // FMI blends five dimensions with weights and momentum to reduce volatility.
  const baseline = buildBaseline(expenses, user);

  const recent = expenses.filter((e) => {
    const d = new Date(e.timestamp);
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  });

  const wantCount = recent.filter((e) => e.classification === 'WANT').length;
  const lateCount = recent.filter((e) => {
    const hour = new Date(e.timestamp).getHours();
    return hour >= 23 || hour <= 4;
  }).length;

  const total = Math.max(1, recent.length);
  const wantRatio = wantCount / total;
  const lateRatio = lateCount / total;

  const D1 = clamp(100 - (wantRatio * 90 + lateRatio * 40));
  const D2 = clamp(baseline.incomeRhythmScore || 60);

  const obligations = (user?.fixedObligations || []).reduce((s, o) => s + Number(o.amount || 0), 0);
  const upcoming = obligations * 0.5;
  const coverageRatio = upcoming > 0 ? currentBalance / upcoming : 2.5;
  let D3 = 50;
  if (coverageRatio > 2.0) D3 = 90;
  else if (coverageRatio > 1.2) D3 = 70;
  else if (coverageRatio > 0.8) D3 = 45;
  else D3 = 20;

  const baselineTotal = Object.values(baseline.avgMonthlyByCategory || {}).reduce((s, v) => s + v, 0);
  const currentTotal = recent.reduce((s, e) => s + Number(e.amount || 0), 0);
  let D4 = 70;
  if (baselineTotal > 0) {
    const ratio = currentTotal / baselineTotal;
    if (ratio > 1.3) D4 = 35;
    else if (ratio > 1.0) D4 = 55;
    else if (ratio > 0.8) D4 = 75;
    else D4 = 85;
  }

  const text = recent.map((e) => e.description || '').join(' ').toLowerCase();
  const stressHits = STRESS_WORDS.filter((w) => text.includes(w)).length;
  const positiveHits = POSITIVE_WORDS.filter((w) => text.includes(w)).length;
  const proHits = PRO_WORDS.filter((w) => text.includes(w)).length;
  let D5 = 60 + (positiveHits * 5) + (proHits * 3) - (stressHits * 6);
  D5 = clamp(D5);

  let weights = { D1: 0.25, D2: 0.2, D3: 0.25, D4: 0.2, D5: 0.1 };
  if (['gig', 'freelancer', 'business'].includes(user?.incomeType)) {
    weights = { D1: 0.2, D2: 0.25, D3: 0.3, D4: 0.15, D5: 0.1 };
  }

  const raw = D1 * weights.D1 + D2 * weights.D2 + D3 * weights.D3 + D4 * weights.D4 + D5 * weights.D5;
  let withMomentum = previousFmi ? (previousFmi.score * 0.7 + raw * 0.3) : raw;

  if (coverageRatio < 0.8) {
    withMomentum -= 10; // sharp dip for missed/at-risk obligations
  }

  const score = clamp(Math.round(withMomentum));

  const reasons = [];
  if (wantRatio > 0.6) reasons.push('Wants spending is dominating recent activity.');
  if (coverageRatio < 1.0) reasons.push('Current balance may not cover upcoming obligations.');
  if (stressHits > 2) reasons.push('Stress-related keywords detected in recent transactions.');

  return {
    score,
    band: bandFor(score),
    dimensions: { D1, D2, D3, D4, D5 },
    reasons,
    baseline
  };
}
