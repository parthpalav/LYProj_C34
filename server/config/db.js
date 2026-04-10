import mongoose from 'mongoose';
import { seedDatabase } from '../utils/seedDatabase.js';
import User from '../models/User.js';

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/lyproj';

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoUri}`);
  
  // Conditional seeding: only seed if database is empty
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await seedDatabase();
  } else {
    console.log('✅ Database already seeded. Skipping seed operation.');
  }
}

export { connectDB };
