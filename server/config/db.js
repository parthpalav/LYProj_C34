import mongoose from 'mongoose';
import { seedDatabase } from '../utils/seedDatabase.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { config } from './env.js';

async function connectDB() {
  const mongoUri = config.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected successfully');

  // Sync schema indexes in non-production or when explicitly requested
  if (process.env.NODE_ENV !== 'production' || process.env.SYNC_INDEXES === 'true') {
    await Transaction.syncIndexes().catch((err) => {
      console.warn('Index sync warning:', err.message);
    });
  }
  
  // Conditional seeding: only seed if database is empty
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await seedDatabase();
  } else {
    console.log('✅ Database already seeded. Skipping seed operation.');
  }
}

export { connectDB };
