import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import FMIHistory from '../models/FMIHistory.js';
import Alert from '../models/Alert.js';
import Envelope from '../models/Envelope.js';
import Income from '../models/Income.js';
import Goal from '../models/Goal.js';

const DEMO_USER_ID = 'u1';

const MOCK_TRANSACTIONS = [
  { id: 't-1', userId: DEMO_USER_ID, amount: 450, category: 'Food & Dining', type: 'Want', sentiment: 'neutral', description: 'Zomato order lunch', timestamp: new Date('2025-03-24T12:30:00') },
  { id: 't-2', userId: DEMO_USER_ID, amount: 1200, category: 'Shopping', type: 'Want', sentiment: 'negative', description: 'Amazon impulse purchase', timestamp: new Date('2025-03-24T23:15:00') },
  { id: 't-3', userId: DEMO_USER_ID, amount: 350, category: 'Transport & Travel', type: 'Need', sentiment: 'neutral', description: 'Uber ride to office', timestamp: new Date('2025-03-25T09:00:00') },
  { id: 't-4', userId: DEMO_USER_ID, amount: 8500, category: 'Utilities & Bills', type: 'Need', sentiment: 'negative', description: 'Electricity bill payment', timestamp: new Date('2025-03-25T11:00:00') },
  { id: 't-5', userId: DEMO_USER_ID, amount: 600, category: 'Food & Dining', type: 'Want', sentiment: 'neutral', description: 'Swiggy dinner', timestamp: new Date('2025-03-26T20:00:00') },
  { id: 't-6', userId: DEMO_USER_ID, amount: 300, category: 'Food & Dining', type: 'Want', sentiment: 'impulse', description: 'Blinkit late night snacks', timestamp: new Date('2025-03-26T23:45:00') },
  { id: 't-7', userId: DEMO_USER_ID, amount: 2000, category: 'Shopping', type: 'Want', sentiment: 'neutral', description: 'Flipkart headphones', timestamp: new Date('2025-03-27T14:00:00') },
  { id: 't-8', userId: DEMO_USER_ID, amount: 500, category: 'Food & Dining', type: 'Want', sentiment: 'neutral', description: 'Restaurant dinner with team', timestamp: new Date('2025-03-27T19:30:00') },
  { id: 't-9', userId: DEMO_USER_ID, amount: 150, category: 'Transport & Travel', type: 'Need', sentiment: 'neutral', description: 'Metro card recharge', timestamp: new Date('2025-03-28T08:00:00') },
  { id: 't-10', userId: DEMO_USER_ID, amount: 4500, category: 'Health', type: 'Need', sentiment: 'neutral', description: 'Pharmacy medicines', timestamp: new Date('2025-03-28T16:00:00') },
];

const MOCK_FMI_HISTORY = [
  { userId: DEMO_USER_ID, score: 48, factors: ['High spending deviation', 'Upcoming bills pressure'], timestamp: new Date('2025-03-20') },
  { userId: DEMO_USER_ID, score: 55, factors: ['High spending deviation'], timestamp: new Date('2025-03-21') },
  { userId: DEMO_USER_ID, score: 62, factors: ['Upcoming bills pressure'], timestamp: new Date('2025-03-22') },
  { userId: DEMO_USER_ID, score: 58, factors: ['High spending deviation', 'Negative spending sentiment'], timestamp: new Date('2025-03-23') },
  { userId: DEMO_USER_ID, score: 70, factors: [], timestamp: new Date('2025-03-24') },
  { userId: DEMO_USER_ID, score: 65, factors: ['Negative spending sentiment'], timestamp: new Date('2025-03-25') },
  { userId: DEMO_USER_ID, score: 72, factors: [], timestamp: new Date('2025-03-26') },
];

const MOCK_INCOME = [
  { id: 'i-1', userId: DEMO_USER_ID, amount: 55000, source: 'salary', description: 'March salary credited', timestamp: new Date('2025-03-01') },
  { id: 'i-2', userId: DEMO_USER_ID, amount: 8000, source: 'freelance', description: 'Web design project', timestamp: new Date('2025-03-10') },
  { id: 'i-3', userId: DEMO_USER_ID, amount: 3500, source: 'gig', description: 'Delivery gig earnings', timestamp: new Date('2025-03-15') },
  { id: 'i-4', userId: DEMO_USER_ID, amount: 12000, source: 'freelance', description: 'Logo design client', timestamp: new Date('2025-03-20') },
];

const MOCK_GOALS = [
  { id: 'g-retirement', userId: DEMO_USER_ID, name: 'Retirement Fund', emoji: '👤', targetAmount: 1000000, savedAmount: 140000, targetDate: 'June 2048', monthlyContribution: 1200 },
  { id: 'g-emergency', userId: DEMO_USER_ID, name: 'Emergency Fund', emoji: '🛡️', targetAmount: 150000, savedAmount: 60000, targetDate: 'December 2025', monthlyContribution: 5000 },
  { id: 'g-vacation', userId: DEMO_USER_ID, name: 'Europe Trip', emoji: '✈️', targetAmount: 80000, savedAmount: 15000, targetDate: 'March 2026', monthlyContribution: 3000 },
];

export async function seedDatabase() {
  console.log('🌱 Seeding database…');

  const configuredPassword = process.env.SEED_USER_PASSWORD;
  const seedPassword = configuredPassword || crypto.randomBytes(12).toString('hex');
  if (!configuredPassword) {
    console.warn('⚠️  SEED_USER_PASSWORD not set. Generated a one-time demo password.');
    console.warn(`    Demo user email: parth@example.com, password: ${seedPassword}`);
  }

  // User
  await User.deleteMany({});
  await User.create({
    id: DEMO_USER_ID,
    name: 'Parth Palav',
    email: 'parth@example.com',
    password: seedPassword,
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
  await Alert.create({ id: 'al-1', userId: DEMO_USER_ID, message: 'Your food spending is 35% above last week.', type: 'nudge', severity: 'medium' });

  // Envelope
  await Envelope.deleteMany({});
  await Envelope.create({ userId: DEMO_USER_ID, rent: 12000, food: 6000, savings: 18500, targetSavings: 50000 });

  console.log('✅ Database seeded successfully!');
}
