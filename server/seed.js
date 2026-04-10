import mongoose from 'mongoose';
import 'dotenv/config';
import { seedDatabase } from './utils/seedDatabase.js';

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/lyproj';

async function runSeed() {
  try {
    const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoUri}`);
    
    await seedDatabase();
    console.log('✅ Manual seeding completed!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runSeed();
