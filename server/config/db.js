import mongoose from 'mongoose';
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
  // Demo seeding is explicit (`npm run seed`). An empty users collection is not
  // a safe signal: a partial restore would still hold transactions worth keeping.
}

export { connectDB };
