import { daysBetween } from '../utils/dateUtils.js';

function groupByCategory(expenses) {
  const out = {};
  expenses.forEach((e) => {
    const key = e.category || 'other';
    out[key] = (out[key] || 0) + Number(e.amount || 0);
  });
  return out;
}

export function buildBaseline(expenses = [], user) {
  // Learning phase grows week by week to avoid premature FMI scoring.
  if (!expenses.length) {
    return {
      phase: 'week1',
      progress: 0,
      ready: false,
      avgWeeklyByCategory: {},
      avgMonthlyByCategory: {},
      typicalHour: 12,
      incomeRhythmScore: user?.incomeType === 'salaried' ? 85 : 60,
      recurringCategories: [],
      savingsPattern: 0,
      fixedObligations: user?.fixedObligations || []
    };
  }

  const sorted = [...expenses].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const first = new Date(sorted[0].timestamp);
  const days = daysBetween(new Date(), first);

  let phase = 'week1';
  let progress = 25;
  if (days >= 7 && days < 14) { phase = 'week2'; progress = 50; }
  else if (days >= 14 && days < 21) { phase = 'week3'; progress = 75; }
  else if (days >= 21) { phase = 'week4'; progress = 100; }

  const avgWeeklyByCategory = groupByCategory(expenses.filter((e) => {
    const d = new Date(e.timestamp);
    return daysBetween(new Date(), d) <= 7;
  }));

  const avgMonthlyByCategory = groupByCategory(expenses.filter((e) => {
    const d = new Date(e.timestamp);
    return daysBetween(new Date(), d) <= 30;
  }));

  const totalHours = expenses.reduce((s, e) => s + new Date(e.timestamp).getHours(), 0);
  const typicalHour = Math.round(totalHours / expenses.length);

  const categoryCounts = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});
  const recurringCategories = Object.keys(categoryCounts).filter((c) => categoryCounts[c] >= 3);

  const investSum = expenses.filter((e) => e.classification === 'INVESTMENT').reduce((s, e) => s + e.amount, 0);
  const totalSum = expenses.reduce((s, e) => s + e.amount, 0);
  const savingsPattern = totalSum > 0 ? investSum / totalSum : 0;

  const incomeRhythmScore = user?.incomeType === 'salaried'
    ? 85
    : user?.incomeType === 'gig' || user?.incomeType === 'freelancer'
      ? 55
      : 65;

  return {
    phase,
    progress,
    ready: progress >= 75,
    avgWeeklyByCategory,
    avgMonthlyByCategory,
    typicalHour,
    incomeRhythmScore,
    recurringCategories,
    savingsPattern,
    fixedObligations: user?.fixedObligations || []
  };
}
