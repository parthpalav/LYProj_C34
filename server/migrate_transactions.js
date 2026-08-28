/**
 * server/migrate_transactions.js
 * ------------------------------
 * Safe Existing-Database Migration Script for FINAURA Transactions.
 *
 * Implements description-aware financial classification:
 *   - Need: Essential survival, bills, basic commuting, essential health
 *   - Want: Discretionary dining, shopping, luxury items, cab/leisure travel
 *   - Investment: Stock market, index funds (nifty50), education human capital
 *
 * Supports modes:
 *   node migrate_transactions.js --dry-run
 *   node migrate_transactions.js --apply [--allow-reviewed-defaults]
 *
 * Default mode: --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj';

const VALID_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
  'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
];

const VALID_TYPES = ['Need', 'Want', 'Investment'];

// Canonical V3 Taxonomy Category Migration Map
export const LEGACY_TO_V3_CATEGORY_MAP = {
  'Food': 'Food & Dining',
  'Travel': 'Transport & Travel',
  'Bills': 'Utilities & Bills',
  'Party': 'Entertainment',
  'Groceries': 'Groceries',
  'Entertainment': 'Entertainment',
  'Shopping': 'Shopping',
  'Health': 'Health',
  'Education': 'Education',
  'Investments': 'Investments',
  'Misc': 'Misc',
};

// Refined Category -> Type Defaults
const REFINED_CATEGORY_TYPE_MAP = {
  'Food & Dining': 'Want',
  Groceries: 'Need',
  'Transport & Travel': 'Want',
  Housing: 'Need',
  'Utilities & Bills': 'Need',
  'Debt & Loan Payments': 'Need',
  Shopping: 'Want',
  Entertainment: 'Want',
  Health: 'Need',
  Education: 'Investment',
  'Personal Care': 'Want',
  Insurance: 'Need',
  Investments: 'Investment',
  Misc: 'Need',
};

// Public transit keywords -> Need
const PUBLIC_TRANSIT_KEYWORDS = [
  'metro', 'metro card', 'bus', 'bus pass', 'public transport',
  'local train', 'railway', 'train commute', 'train pass'
];

// Investment keywords
const INVESTMENT_KEYWORDS = [
  'nifty', 'nifty50', 'sensex', 'stock', 'stocks', 'equity',
  'shares', 'mutual fund', 'sip', 'etf', 'investment'
];

// Luxury keywords -> Shopping (Want)
const LUXURY_KEYWORDS = [
  'watch', 'luxury', 'jewellery', 'jewelry', 'premium', 'designer'
];

// Keyword to Category Maps
const KEYWORD_CATEGORY_MAP = {
  Food: ['zomato', 'swiggy', 'pizza', 'burger', 'burgers', 'restaurant', 'cafe', 'lunch', 'dinner', 'food', 'mess', 'canteen'],
  Travel: ['uber', 'ola', 'rapido', 'auto', 'metro', 'cab', 'bus', 'train', 'flight', 'petrol', 'fuel', 'irctc', 'taxi'],
  Entertainment: ['netflix', 'spotify', 'movie', 'prime', 'hotstar', 'pvr', 'inox', 'gaming'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'clothes', 'shoes', 'shopping', 'watch', 'jewellery'],
  Bills: ['electricity', 'recharge', 'bill', 'wifi', 'rent', 'emi', 'loan', 'dth'],
  Groceries: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'groceries', 'supermarket', 'dmart', 'milk', 'vegetables'],
  Health: ['doctor', 'hospital', 'medicine', 'pharmacy', 'clinic', 'tablets', 'health', 'lab test'],
  Party: ['party', 'pub', 'bar', 'club', 'alcohol', 'drinks'],
  Education: ['course', 'udemy', 'coursera', 'books', 'book', 'tuition', 'coaching', 'college', 'fees', 'school'],
};

function resolveCategoryAndType(tx) {
  const descLower = (tx.description || '').trim().toLowerCase();
  const rawCatLower = (tx.category || '').trim().toLowerCase();
  const existingType = (tx.type && VALID_TYPES.includes(tx.type)) ? tx.type : null;

  let proposedCategory = null;
  let categoryAction = 'UNCHANGED';

  // ── Step 1: Check Description Contradiction / Specificity ────────────────────
  // E.g. t-1775816889956: desc is "Shopping" but raw category was "food"
  if (descLower === 'shopping' && rawCatLower !== 'shopping') {
    proposedCategory = 'Shopping';
    categoryAction = 'CORRECTED_DESCRIPTION_CONTRADICTION';
  } else if (descLower === 'pizza' && rawCatLower === 'misc') {
    proposedCategory = 'Food';
    categoryAction = 'RECARVED_FROM_MISC';
  } else if (descLower === 'uber' && rawCatLower === 'misc') {
    proposedCategory = 'Travel';
    categoryAction = 'RECARVED_FROM_MISC';
  } else if (descLower === 'watch' && rawCatLower === 'misc') {
    proposedCategory = 'Shopping';
    categoryAction = 'RECARVED_FROM_MISC';
  } else if (rawCatLower === 'misc' || !rawCatLower) {
    // Check description for recognizable category keywords
    for (const [cat, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
      if (keywords.some(kw => descLower.includes(kw))) {
        proposedCategory = cat;
        categoryAction = 'RECARVED_FROM_MISC';
        break;
      }
    }
    if (!proposedCategory) {
      proposedCategory = 'Misc';
      categoryAction = 'UNCHANGED';
    }
  } else {
    // Check legacy V1/V2 to V3 mapping first
    const legacyV3Match = Object.entries(LEGACY_TO_V3_CATEGORY_MAP).find(
      ([leg, v3]) => leg.toLowerCase() === rawCatLower
    );
    if (legacyV3Match) {
      proposedCategory = legacyV3Match[1];
      categoryAction = proposedCategory === tx.category ? 'UNCHANGED' : 'MIGRATED_TO_V3';
    } else {
      // Standard normalization: map lowercase to canonical casing
      const exactMatch = VALID_CATEGORIES.find(c => c.toLowerCase() === rawCatLower);
      if (exactMatch) {
        proposedCategory = exactMatch;
        categoryAction = exactMatch === tx.category ? 'UNCHANGED' : 'NORMALIZED_CASE';
      } else {
        proposedCategory = 'Misc';
        categoryAction = 'UNRECOGNIZED_CATEGORY_DEFAULT_MISC';
      }
    }
  }

  // ── Step 2: Determine Type & Confidence ──────────────────────────────────────
  let proposedType = null;
  let confidence = 'HIGH';
  let reason = '';
  let reviewRequired = false;

  // Rule 2A: Preserve existing valid type unless strongly contradicted
  if (existingType) {
    proposedType = existingType;
    reason = `Preserved existing valid user type '${existingType}'`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2B: Stock / Index / Investment keywords
  else if (INVESTMENT_KEYWORDS.some(kw => descLower.includes(kw))) {
    proposedType = 'Investment';
    reason = `Investment keyword ('${descLower}') detected`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2C: Public Transit Commute -> Need
  else if (PUBLIC_TRANSIT_KEYWORDS.some(kw => descLower.includes(kw))) {
    proposedType = 'Need';
    reason = `Public transit commute ('${descLower}') classified as essential Need`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2D: Luxury item -> Shopping (Want)
  else if (LUXURY_KEYWORDS.some(kw => descLower.includes(kw))) {
    proposedType = 'Want';
    reason = `Luxury item ('${descLower}') classified as discretionary Want`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2E: Health -> Need (Medicines / Doctor / Pharmacy)
  else if (proposedCategory === 'Health') {
    proposedType = 'Need';
    reason = `Essential healthcare/medicine classified as Need`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2F: Work commute in taxi vs generic cab
  else if (descLower.includes('uber ride to office')) {
    // Contextual: daily commute to office is an approved Need
    proposedType = 'Need';
    reason = `Work commute ('${descLower}') classified as Need`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2G: Standard category mapping fallback
  else if (REFINED_CATEGORY_TYPE_MAP[proposedCategory]) {
    proposedType = REFINED_CATEGORY_TYPE_MAP[proposedCategory];
    reason = `Mapped from category '${proposedCategory}' via refined rules (${proposedType})`;
    confidence = 'HIGH';
    reviewRequired = false;
  }
  // Rule 2H: Unresolved Misc fallback
  else {
    proposedType = 'Need';
    reason = `Unresolved Misc category defaulted to Need`;
    confidence = 'LOW';
    reviewRequired = true;
  }

  return {
    proposedCategory,
    categoryAction,
    proposedType,
    confidence,
    reason,
    reviewRequired
  };
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');
  const allowReviewedDefaults = args.includes('--allow-reviewed-defaults');

  console.log('='.repeat(130));
  console.log(`  FINAURA TRANSACTION MIGRATION (${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'})`);
  console.log('='.repeat(130));

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('transactions');

  const transactions = await collection.find({}).sort({ timestamp: 1 }).toArray();
  console.log(`\nFound ${transactions.length} total transactions in database.\n`);

  const plan = [];
  let categoryChangesCount = 0;
  let typeChangesCount = 0;
  let missingTypesCount = 0;
  let typesProposedCount = 0;
  let typesPreservedCount = 0;
  let recarvedMiscCount = 0;
  let highConfCount = 0;
  let medConfCount = 0;
  let lowConfCount = 0;
  let reviewRequiredCount = 0;

  for (const tx of transactions) {
    const res = resolveCategoryAndType(tx);

    const isCatChanged = tx.category !== res.proposedCategory;
    const isTypeMissing = !tx.type;
    const isTypeChanged = tx.type !== res.proposedType;

    if (isCatChanged) categoryChangesCount++;
    if (isTypeMissing) {
      missingTypesCount++;
      typesProposedCount++;
    } else {
      typesPreservedCount++;
    }
    if (isTypeChanged) typeChangesCount++;
    if (res.categoryAction.includes('RECARVED')) recarvedMiscCount++;

    if (res.confidence === 'HIGH') highConfCount++;
    else if (res.confidence === 'MEDIUM') medConfCount++;
    else if (res.confidence === 'LOW') lowConfCount++;

    if (res.reviewRequired) reviewRequiredCount++;

    const timestampDate = tx.timestamp ? new Date(tx.timestamp) : new Date();

    plan.push({
      _id: tx._id,
      id: tx.id,
      description: tx.description || '',
      amount: tx.amount,
      existingCategory: tx.category || '<missing>',
      proposedCategory: res.proposedCategory,
      existingType: tx.type || '<missing>',
      proposedType: res.proposedType,
      confidence: res.confidence,
      reason: res.reason,
      reviewRequired: res.reviewRequired,
      categoryAction: res.categoryAction,
      userId: tx.userId,
      timestamp: timestampDate,
      sentiment: tx.sentiment || 'neutral',
      sentimentScore: tx.sentimentScore ?? 0,
      confidenceScore: tx.confidenceScore ?? 0,
      classificationSource: tx.classificationSource ?? 'unknown',
      tags: tx.tags || [],
      isAnomaly: tx.isAnomaly ?? false,
      createdAt: tx.createdAt || timestampDate,
      updatedAt: tx.updatedAt || timestampDate
    });
  }

  // ── Print Complete Table ────────────────────────────────────────────────
  console.log('-'.repeat(130));
  console.log(
    `${'ID'.padEnd(16)} | ${'Description'.padEnd(25)} | ${'Amount'.padEnd(8)} | ${'Exist Cat'.padEnd(10)} | ${'Prop Cat'.padEnd(10)} | ${'Exist Type'.padEnd(10)} | ${'Prop Type'.padEnd(10)} | ${'Conf'.padEnd(6)} | ${'Review'.padEnd(6)}`
  );
  console.log('-'.repeat(130));

  for (const item of plan) {
    const desc = item.description.length > 24 ? item.description.substring(0, 21) + '...' : item.description;
    const amtStr = `₹${item.amount}`;
    const revStr = item.reviewRequired ? 'YES ⚠️' : 'NO ✅';
    console.log(
      `${item.id.padEnd(16)} | ${desc.padEnd(25)} | ${amtStr.padEnd(8)} | ${item.existingCategory.padEnd(10)} | ${item.proposedCategory.padEnd(10)} | ${item.existingType.padEnd(10)} | ${item.proposedType.padEnd(10)} | ${item.confidence.padEnd(6)} | ${revStr.padEnd(6)}`
    );
  }
  console.log('-'.repeat(130));

  console.log('\n--- REVISED MIGRATION METRICS ---');
  console.log(`Total transactions:               ${transactions.length}`);
  console.log(`Total HIGH confidence:            ${highConfCount}`);
  console.log(`Total MEDIUM confidence:          ${medConfCount}`);
  console.log(`Total LOW confidence:             ${lowConfCount}`);
  console.log(`Total requiring manual review:    ${reviewRequiredCount}`);
  console.log(`Category corrections:             ${categoryChangesCount}`);
  console.log(`Type corrections / additions:    ${typeChangesCount}`);
  console.log(`Transactions with type preserved: ${typesPreservedCount}`);
  console.log(`Transactions with type inferred:  ${typesProposedCount}`);
  console.log(`Transactions recarved from Misc:  ${recarvedMiscCount}`);

  if (!isApply) {
    console.log('\n' + '='.repeat(130));
    console.log('  SAFETY CONFIRMATION: NO DATABASE CHANGES WERE MADE. (DRY-RUN COMPLETE)');
    console.log('='.repeat(130));
    await mongoose.disconnect();
    return plan;
  }

  // ── Apply Execution (Disabled unless explicitly invoked) ──────────────────
  if (reviewRequiredCount > 0 && !allowReviewedDefaults) {
    console.error(`\n❌ MIGRATION BLOCKED: ${reviewRequiredCount} transaction(s) require manual review.`);
    console.error('Run with --allow-reviewed-defaults to apply defaults for reviewed items, or resolve them explicitly.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const backupDir = path.join(__dirname, '..', '.backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, `transactions_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(transactions, null, 2));
  console.log(`\n📦 Safety backup created at: ${backupPath}`);

  console.log('\n⏳ Applying updates to MongoDB...');
  let updatedCount = 0;

  for (const item of plan) {
    const updateDoc = {
      $set: {
        category: item.proposedCategory,
        type: item.proposedType,
        confidenceScore: item.confidenceScore,
        classificationSource: item.classificationSource,
        tags: item.tags,
        sentimentScore: item.sentimentScore,
        isAnomaly: item.isAnomaly,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    };

    await collection.updateOne({ _id: item._id }, updateDoc);
    updatedCount++;
  }

  console.log(`\n✅ Successfully updated ${updatedCount} transactions.`);

  await mongoose.disconnect();
  return plan;
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
