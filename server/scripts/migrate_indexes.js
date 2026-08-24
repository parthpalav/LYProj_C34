import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Transaction from '../models/Transaction.js';
import 'dotenv/config';

async function migrate() {
  console.log('============================================================');
  console.log('  FINAURA DATABASE INDEX MIGRATION SCRIPT');
  console.log('============================================================\n');

  await connectDB();

  console.log('Inspecting Transaction collection indexes...');
  const indexes = await Transaction.collection.indexes();

  // Find if the old unique+sparse index exists (without partialFilterExpression)
  const oldIndex = indexes.find(
    idx => idx.name === 'liabilityId_1_scheduledFor_1' && !idx.partialFilterExpression
  );

  if (oldIndex) {
    console.log('Found outdated unique+sparse index definition. Dropping index...');
    await Transaction.collection.dropIndex('liabilityId_1_scheduledFor_1');
    console.log('Old index liabilityId_1_scheduledFor_1 dropped successfully.');
  } else {
    console.log('No outdated index definition detected.');
  }

  console.log('Syncing Transaction indexes with the schema...');
  const synced = await Transaction.syncIndexes();
  console.log('Successfully synced indexes. Result:', synced);

  console.log('\nMigration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
