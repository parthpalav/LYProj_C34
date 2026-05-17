const NEED_KEYWORDS = ['rent', 'bill', 'medicine', 'groceries', 'school', 'fees', 'electricity', 'water', 'gas'];
const WANT_KEYWORDS = ['friends', 'party', 'late night', 'dinner', 'shopping', 'movie', 'snacks', 'shopping', 'club'];
const INVEST_KEYWORDS = ['sip', 'investment', 'gold', 'silver', 'mutual fund', 'saving'];
const PRO_KEYWORDS = ['client', 'meeting', 'office', 'tools', 'workshop'];

const NEED_CATEGORIES = ['rent', 'bills', 'medicine', 'groceries', 'family', 'office tools', 'client meeting', 'education'];
const WANT_CATEGORIES = ['food', 'party', 'shopping', 'entertainment', 'travel', 'subscriptions', 'gym'];
const INVEST_CATEGORIES = ['sip', 'investment', 'gold', 'silver', 'emergency'];

function keywordScore(desc, list, boost) {
  const found = list.filter((k) => desc.includes(k));
  return { score: found.length * boost, found };
}

export function classifyExpense({ expense, user, baseline, history }) {
  // Rule-based scoring using category, keywords, timing, baseline, and recurrence.
  const amount = Number(expense.amount || 0);
  const category = (expense.category || '').toLowerCase();
  const description = (expense.description || '').toLowerCase();
  const timestamp = expense.timestamp ? new Date(expense.timestamp) : new Date();
  const hour = timestamp.getHours();
  const day = timestamp.getDate();

  let needScore = 1;
  let wantScore = 1;
  let investScore = 1;
  const reasons = [];

  if (NEED_CATEGORIES.includes(category)) { needScore += 3; reasons.push('Category aligns with essential spending'); }
  if (WANT_CATEGORIES.includes(category)) { wantScore += 3; reasons.push('Category aligns with discretionary spending'); }
  if (INVEST_CATEGORIES.includes(category)) { investScore += 3; reasons.push('Category aligns with investment'); }

  const needKw = keywordScore(description, NEED_KEYWORDS, 2);
  const wantKw = keywordScore(description, WANT_KEYWORDS, 2);
  const investKw = keywordScore(description, INVEST_KEYWORDS, 2);
  const proKw = keywordScore(description, PRO_KEYWORDS, 2);

  needScore += needKw.score;
  wantScore += wantKw.score;
  investScore += investKw.score;

  if (needKw.found.length) reasons.push('Essential keywords detected');
  if (wantKw.found.length) reasons.push('Discretionary keywords detected');
  if (investKw.found.length) reasons.push('Investment keywords detected');
  if (proKw.found.length) { needScore += 1; investScore += 1; reasons.push('Professional context detected'); }

  if (hour >= 23 || hour <= 4) {
    wantScore += 2;
    reasons.push('Late-night timing indicates discretionary spend');
  }

  if (day <= 7 && (category === 'rent' || category === 'bills')) {
    needScore += 2;
    reasons.push('First-week rent or bills detected');
  }

  const avgMonthly = baseline?.avgMonthlyByCategory?.[category];
  if (avgMonthly) {
    if (amount > avgMonthly * 1.5) {
      wantScore += 2;
      reasons.push('Spend above baseline for this category');
    } else if (amount < avgMonthly * 0.8) {
      needScore += 1;
      reasons.push('Spend below baseline for this category');
    }
  }

  if (history?.length) {
    const recentSame = history.filter((h) => h.category === category);
    const similar = recentSame.filter((h) => Math.abs(h.amount - amount) / Math.max(1, amount) < 0.1);
    if (similar.length >= 2) {
      needScore += 2;
      reasons.push('Recurring expense pattern detected');
    }
  }

  if (user?.income && user.income < 20000 && (category === 'gym' || category === 'entertainment')) {
    wantScore += 2;
    reasons.push('Low income week with discretionary category');
  }

  const scores = { NEED: needScore, WANT: wantScore, INVESTMENT: investScore };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const label = sorted[0][0];
  const total = needScore + wantScore + investScore;
  const confidence = total > 0 ? sorted[0][1] / total : 0.33;

  return { label, confidence: Math.min(1, Math.max(0.1, confidence)), reasons };
}
