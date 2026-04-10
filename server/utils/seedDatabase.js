import User        from '../models/User.js';
import Transaction from '../models/Transaction.js';
import FMIHistory  from '../models/FMIHistory.js';
import Alert       from '../models/Alert.js';
import Envelope    from '../models/Envelope.js';
import Income      from '../models/Income.js';
import Goal        from '../models/Goal.js';

const MOCK_TRANSACTIONS = [
  { id: 't-1', userId: 'u1', amount: 450,  category: 'food',        sentiment: 'neutral',  description: 'Zomato order lunch',         timestamp: new Date('2025-03-24T12:30:00') },
  { id: 't-2', userId: 'u1', amount: 1200, category: 'shopping',    sentiment: 'negative', description: 'Amazon impulse purchase',     timestamp: new Date('2025-03-24T23:15:00') },
  { id: 't-3', userId: 'u1', amount: 350,  category: 'travel',      sentiment: 'neutral',  description: 'Uber ride to office',        timestamp: new Date('2025-03-25T09:00:00') },
  { id: 't-4', userId: 'u1', amount: 8500, category: 'bills',       sentiment: 'negative', description: 'Electricity bill payment',   timestamp: new Date('2025-03-25T11:00:00') },
  { id: 't-5', userId: 'u1', amount: 600,  category: 'food',        sentiment: 'neutral',  description: 'Swiggy dinner',              timestamp: new Date('2025-03-26T20:00:00') },
  { id: 't-6', userId: 'u1', amount: 300,  category: 'food',        sentiment: 'impulse',  description: 'Blinkit late night snacks',  timestamp: new Date('2025-03-26T23:45:00') },
  { id: 't-7', userId: 'u1', amount: 2000, category: 'shopping',    sentiment: 'neutral',  description: 'Flipkart headphones',        timestamp: new Date('2025-03-27T14:00:00') },
  { id: 't-8', userId: 'u1', amount: 500,  category: 'food',        sentiment: 'neutral',  description: 'Restaurant dinner with team', timestamp: new Date('2025-03-27T19:30:00') },
  { id: 't-9', userId: 'u1', amount: 150,  category: 'travel',      sentiment: 'neutral',  description: 'Metro card recharge',        timestamp: new Date('2025-03-28T08:00:00') },
  { id: 't-10',userId: 'u1', amount: 4500, category: 'health',      sentiment: 'neutral',  description: 'Pharmacy medicines',         timestamp: new Date('2025-03-28T16:00:00') },
];

const MOCK_FMI_HISTORY = [
  { score: 48, factors: ['High spending deviation', 'Upcoming bills pressure'], timestamp: new Date('2025-03-20') },
  { score: 55, factors: ['High spending deviation'], timestamp: new Date('2025-03-21') },
  { score: 62, factors: ['Upcoming bills pressure'], timestamp: new Date('2025-03-22') },
  { score: 58, factors: ['High spending deviation', 'Negative spending sentiment'], timestamp: new Date('2025-03-23') },
  { score: 70, factors: [], timestamp: new Date('2025-03-24') },
  { score: 65, factors: ['Negative spending sentiment'], timestamp: new Date('2025-03-25') },
  { score: 72, factors: [], timestamp: new Date('2025-03-26') },
];

const MOCK_INCOME = [
  { id: 'i-1', userId: 'u1', amount: 55000, source: 'salary',    description: 'March salary credited', timestamp: new Date('2025-03-01') },
  { id: 'i-2', userId: 'u1', amount: 8000,  source: 'freelance', description: 'Web design project',   timestamp: new Date('2025-03-10') },
  { id: 'i-3', userId: 'u1', amount: 3500,  source: 'gig',       description: 'Delivery gig earnings', timestamp: new Date('2025-03-15') },
  { id: 'i-4', userId: 'u1', amount: 12000, source: 'freelance', description: 'Logo design client',   timestamp: new Date('2025-03-20') },
];

const MOCK_GOALS = [
  { id: 'g-retirement', userId: 'u1', name: 'Retirement Fund', emoji: '👤', targetAmount: 1000000, savedAmount: 140000, targetDate: 'June 2048', monthlyContribution: 1200 },
  { id: 'g-emergency',  userId: 'u1', name: 'Emergency Fund',  emoji: '🛡️', targetAmount: 150000,  savedAmount: 60000,  targetDate: 'December 2025', monthlyContribution: 5000 },
  { id: 'g-vacation',   userId: 'u1', name: 'Europe Trip',     emoji: '✈️', targetAmount: 80000,   savedAmount: 15000,  targetDate: 'March 2026',    monthlyContribution: 3000 },
];

export async function seedDatabase() {
  console.log('🌱 Seeding database…');

  // User
  await User.deleteMany({});
  await User.create({ 
    id: 'u1', 
    name: 'Parth Palav', 
    email: 'parth@example.com',
    password: 'password123',
    incomeType: 'salaried', 
    goals: ['retirement', 'emergency'] 
  });

  // Transactions
  await Transaction.deleteMany({});
  await Transaction.insertMany(MOCK_TRANSACTIONS);

  // FMI History
  await FMIHistory.deleteMany({});
  await FMIHistory.insertMany(MOCK_FMI_HISTORY);

  // Income
  await Income.deleteMany({});
  await Income.insertMany(MOCK_INCOME);

  // Goals
  await Goal.deleteMany({});
  await Goal.insertMany(MOCK_GOALS);

  // Alert
  await Alert.deleteMany({});
  await Alert.create({ id: 'al-1', userId: 'u1', message: 'Your food spending is 35% above last week.', type: 'nudge', severity: 'medium' });

  // Envelope
  await Envelope.deleteMany({});
  await Envelope.create({ userId: 'u1', rent: 12000, food: 6000, savings: 18500, targetSavings: 50000 });

  console.log('✅ Database seeded successfully!');
}
