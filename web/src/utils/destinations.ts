/** Every place in the web app a user can jump to. Feeds the command palette and the Overview quick actions. */
export interface Destination {
  label: string;
  hint: string;
  to: string;
  /** Extra words the search should match. */
  keywords?: string;
  /** Shown as a quick action on Overview. */
  quick?: boolean;
}

export const DESTINATIONS: Destination[] = [
  { label: 'Record an expense', hint: 'Type what you paid for; the label fills in', to: '/app/activity?entry=new', keywords: 'add transaction spend payment new', quick: true },
  { label: 'Add income', hint: 'Salary and other receipts', to: '/app/activity?tab=income', keywords: 'salary receipt earn', quick: true },
  { label: 'Add a bill or loan', hint: 'EMIs, rent, subscriptions', to: '/app/net-worth?tab=liabilities&add=liability', keywords: 'liability emi debt subscription', quick: true },
  { label: 'Add an asset', hint: 'FD, RD, SIP, gold, property', to: '/app/net-worth?tab=assets&add=asset', keywords: 'investment deposit mutual fund', quick: true },
  { label: 'Ask the assistant', hint: 'Answers from your own numbers', to: '/app/assistant', keywords: 'ai chat copilot question', quick: true },
  { label: 'Try a what-if', hint: 'Scenario lab: 10,000 simulated futures', to: '/app/plan?tab=scenarios', keywords: 'monte carlo simulate retirement scenario', quick: true },
  { label: 'Overview', hint: 'Balance, score and what needs attention', to: '/app', keywords: 'home dashboard' },
  { label: 'Activity', hint: 'All transactions, search and filters', to: '/app/activity', keywords: 'ledger history transactions' },
  { label: 'Check AI guesses', hint: 'Confirm labels FINAURA was unsure about', to: '/app/review', keywords: 'review classify correct' },
  { label: 'Net worth', hint: 'Assets, loans, cards and bills', to: '/app/net-worth', keywords: 'assets liabilities balance sheet' },
  { label: 'Liabilities', hint: 'Loans, credit cards, bills', to: '/app/net-worth?tab=liabilities', keywords: 'emi card bill due pay' },
  { label: 'Net worth breakdown', hint: 'Where your wealth sits', to: '/app/net-worth?tab=breakdown', keywords: 'allocation chart' },
  { label: 'Play monthly recap', hint: 'Your month as a short story', to: '/app/recap', keywords: 'wrapped summary story month' },
  { label: 'Round-ups', hint: 'Save the loose change', to: '/app/roundups', keywords: 'vault savings envelope' },
  { label: 'Spending insights', hint: 'Trends, categories and calendar', to: '/app/insights', keywords: 'analytics chart heatmap' },
  { label: 'FMI health', hint: 'Your Financial Maturity Index and why', to: '/app/insights?tab=fmi', keywords: 'score pillars history' },
  { label: 'Behaviour', hint: 'Risk patterns and unusual spends', to: '/app/insights?tab=behaviour', keywords: 'anomaly impulse prediction' },
  { label: 'Income stability', hint: 'Sources and volatility', to: '/app/insights?tab=income', keywords: 'gig salary trend' },
  { label: 'Family', hint: 'Household score and who contributes what', to: '/app/family', keywords: 'household members invite shapley' },
  { label: 'Goals', hint: 'Create and fund savings goals', to: '/app/plan', keywords: 'target saving plan' },
  { label: 'FIRE', hint: 'Your retirement number and date', to: '/app/plan?tab=fire', keywords: 'retirement corpus independence' },
  { label: 'Weekly report', hint: 'The last 7 days', to: '/app/reports', keywords: 'review summary' },
  { label: 'Monthly report', hint: 'Any calendar month', to: '/app/reports?tab=monthly', keywords: 'statement summary' },
  { label: 'Report history', hint: 'Month by month', to: '/app/reports?tab=history', keywords: 'past trend' },
  { label: 'Export data', hint: 'Download CSV files', to: '/app/reports?tab=export', keywords: 'download csv backup' },
  { label: 'Profile', hint: 'Details, payment methods, assumptions, theme', to: '/app/profile', keywords: 'account upi card timezone dark mode' },
  { label: 'Settings', hint: 'Password, service status', to: '/app/settings', keywords: 'security change password status' },
];

/** Case-insensitive match where every typed word must appear somewhere in the entry. */
export function searchDestinations(query: string, list: Destination[] = DESTINATIONS): Destination[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((d) => {
    const haystack = `${d.label} ${d.hint} ${d.keywords ?? ''}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}
