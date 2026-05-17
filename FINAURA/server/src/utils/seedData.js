export const seedUser = {
  name: 'Demo User',
  email: 'demo@finaura.app',
  passwordHash: 'replace-with-hash',
  age: 28,
  income: 60000,
  incomeType: 'salaried',
  retirementAge: 60,
  retirementCorpusGoal: 15000000,
  currentBalance: 75000,
  fixedObligations: [
    { label: 'Rent', amount: 15000 },
    { label: 'Bills', amount: 4000 }
  ],
  onboardingCompleted: true
};

export const seedExpenses = [
  { amount: 350, category: 'food', description: 'lunch', classification: 'NEED', confidence: 0.7, reasons: ['Category aligns with essential spending'] },
  { amount: 1200, category: 'shopping', description: 'late night shopping', classification: 'WANT', confidence: 0.6, reasons: ['Late-night timing indicates discretionary spend'] },
  { amount: 2000, category: 'sip', description: 'monthly sip', classification: 'INVESTMENT', confidence: 0.8, reasons: ['Investment keywords detected'] }
];
