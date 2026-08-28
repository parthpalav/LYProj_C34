/**
 * db_diagnostic.js — READ-ONLY audit of existing transaction documents.
 *
 * Reports:
 *   - Total transaction count
 *   - How many are missing `type`, `category`, `confidenceScore`, `timestamp`
 *   - Whether createdAt/updatedAt already exist on any documents
 *   - Whether phantom fields (tags, sentimentScore, isAnomaly) exist
 *   - Whether any unexpected category/type values exist
 *   - Distribution of categories and types
 *
 * Usage:  node db_diagnostic.js
 *
 * NOTE: This script does NOT modify any records.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/finaura';

const VALID_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
  'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
];
const VALID_TYPES      = ['Need', 'Want', 'Investment'];

async function main() {
  console.log('='.repeat(70));
  console.log('  FINAURA DATABASE DIAGNOSTIC (READ-ONLY)');
  console.log('='.repeat(70));
  console.log(`\nConnecting to: ${MONGO_URI}\n`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const txCollection = db.collection('transactions');

  const allTx = await txCollection.find({}).toArray();
  const total = allTx.length;
  console.log(`Total transactions: ${total}`);

  if (total === 0) {
    console.log('\nNo transactions found. Nothing to audit.');
    await mongoose.disconnect();
    return;
  }

  // Missing fields
  const missingType           = allTx.filter(t => !t.type).length;
  const missingCategory       = allTx.filter(t => !t.category).length;
  const missingConfidence     = allTx.filter(t => t.confidenceScore === undefined || t.confidenceScore === null).length;
  const missingTimestamp      = allTx.filter(t => !t.timestamp).length;
  const missingUserId         = allTx.filter(t => !t.userId).length;
  const missingDescription    = allTx.filter(t => !t.description).length;

  console.log('\n--- Missing Required Fields ---');
  console.log(`  Missing type:            ${missingType}/${total}`);
  console.log(`  Missing category:        ${missingCategory}/${total}`);
  console.log(`  Missing confidenceScore: ${missingConfidence}/${total}`);
  console.log(`  Missing timestamp:       ${missingTimestamp}/${total}`);
  console.log(`  Missing userId:          ${missingUserId}/${total}`);
  console.log(`  Missing description:     ${missingDescription}/${total}`);

  // Phantom fields
  const hasCreatedAt      = allTx.filter(t => t.createdAt !== undefined).length;
  const hasUpdatedAt      = allTx.filter(t => t.updatedAt !== undefined).length;
  const hasTags           = allTx.filter(t => t.tags !== undefined).length;
  const hasSentimentScore = allTx.filter(t => t.sentimentScore !== undefined).length;
  const hasIsAnomaly      = allTx.filter(t => t.isAnomaly !== undefined).length;
  const hasClassSource    = allTx.filter(t => t.classificationSource !== undefined).length;

  console.log('\n--- Existing Phantom / Optional Fields ---');
  console.log(`  createdAt present:            ${hasCreatedAt}/${total}`);
  console.log(`  updatedAt present:            ${hasUpdatedAt}/${total}`);
  console.log(`  tags present:                 ${hasTags}/${total}`);
  console.log(`  sentimentScore present:       ${hasSentimentScore}/${total}`);
  console.log(`  isAnomaly present:            ${hasIsAnomaly}/${total}`);
  console.log(`  classificationSource present: ${hasClassSource}/${total}`);

  // Category distribution
  const catCounts = {};
  const typeCounts = {};
  const invalidCats = [];
  const invalidTypes = [];

  for (const tx of allTx) {
    const cat = tx.category || '<missing>';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    if (tx.category && !VALID_CATEGORIES.includes(tx.category)) {
      invalidCats.push({ id: tx.id, category: tx.category });
    }

    const type = tx.type || '<missing>';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (tx.type && !VALID_TYPES.includes(tx.type)) {
      invalidTypes.push({ id: tx.id, type: tx.type });
    }
  }

  console.log('\n--- Category Distribution ---');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    const valid = VALID_CATEGORIES.includes(cat) ? '✅' : '❌';
    console.log(`  ${valid} ${cat}: ${count}`);
  }

  console.log('\n--- Type Distribution ---');
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    const valid = VALID_TYPES.includes(type) ? '✅' : '❌';
    console.log(`  ${valid} ${type}: ${count}`);
  }

  if (invalidCats.length) {
    console.log(`\n⚠️  ${invalidCats.length} transaction(s) have invalid categories:`);
    invalidCats.slice(0, 10).forEach(t => console.log(`    id=${t.id} category="${t.category}"`));
  }

  if (invalidTypes.length) {
    console.log(`\n⚠️  ${invalidTypes.length} transaction(s) have invalid types:`);
    invalidTypes.slice(0, 10).forEach(t => console.log(`    id=${t.id} type="${t.type}"`));
  }

  // Sample a few transactions
  console.log('\n--- Sample Transactions (first 3) ---');
  for (const tx of allTx.slice(0, 3)) {
    console.log(JSON.stringify(tx, null, 2));
  }

  console.log('\n' + '='.repeat(70));
  console.log('  DIAGNOSTIC COMPLETE — NO RECORDS MODIFIED');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
