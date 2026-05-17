import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/finaura';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI);
  console.log('[db] connected');
}
