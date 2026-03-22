const transactions = [
  {
    id: 't1',
    userId: 'u1',
    amount: 1450,
    category: 'food',
    sentiment: 'negative',
    description: 'Late night food order',
    timestamp: '2026-03-19T10:00:00.000Z'
  },
  {
    id: 't2',
    userId: 'u1',
    amount: 420,
    category: 'travel',
    sentiment: 'neutral',
    description: 'Auto ride',
    timestamp: '2026-03-19T14:00:00.000Z'
  },
  {
    id: 't3',
    userId: 'u1',
    amount: 5600,
    category: 'shopping',
    sentiment: 'negative',
    description: 'Unplanned shopping',
    timestamp: '2026-03-20T08:00:00.000Z'
  },
  {
    id: 't4',
    userId: 'u1',
    amount: 900,
    category: 'bills',
    sentiment: 'neutral',
    description: 'Electricity bill',
    timestamp: '2026-03-20T12:00:00.000Z'
  }
];

const fmiHistory = [
  { score: 71, factors: ['stable income'], timestamp: '2026-03-14T00:00:00.000Z' },
  { score: 68, factors: ['food overspending'], timestamp: '2026-03-16T00:00:00.000Z' },
  { score: 64, factors: ['shopping spike'], timestamp: '2026-03-18T00:00:00.000Z' },
  { score: 62, factors: ['upcoming bills', 'overspending'], timestamp: '2026-03-20T00:00:00.000Z' }
];

const alerts = [
  { id: 'a1', userId: 'u1', message: 'You may overspend this weekend.', type: 'nudge', severity: 'medium' },
  { id: 'a2', userId: 'u1', message: 'Balance could drop below safe threshold in 3 days.', type: 'warning', severity: 'high' }
];

const user = {
  id: 'u1',
  name: 'Parth',
  incomeType: 'monthly',
  goals: ['Build emergency fund']
};

const envelopes = {
  userId: 'u1',
  rent: 18000,
  food: 8000,
  savings: 5000,
  targetSavings: 12000
};

module.exports = {
  transactions,
  fmiHistory,
  alerts,
  user,
  envelopes
};
