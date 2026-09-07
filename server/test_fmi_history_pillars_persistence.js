/**
 * server/test_fmi_history_pillars_persistence.js
 * 
 * Unit & Integration test suite verifying that:
 * 1. Legacy FMIHistory records without pillars remain valid and readable with pillars: null.
 * 2. New FMI snapshots persist computed.pillars intact without reconstructing formulas.
 * 3. normalizeFmi outputs pillars: null for legacy snapshots and the full pillars object for new snapshots.
 * 4. Existing mobile contract (score, factors, timestamp) remains unaffected.
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import FMIHistory from './models/FMIHistory.js';
import { connectDB } from './config/db.js';

console.log('='.repeat(64));
console.log('  FINAURA FMI HISTORY PILLARS PERSISTENCE TEST SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ Passed');
  } catch (err) {
    failed++;
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err);
  }
}

// Mirror normalizeFmi from controllers/index.js
function normalizeFmi(item) {
  return {
    score: item.score,
    factors: item.factors,
    timestamp: item.timestamp,
    pillars: item.pillars || null
  };
}

async function runSuite() {
  await connectDB();

  const testUserId = `test-pillar-user-${Date.now()}`;
  const legacyDocId = new mongoose.Types.ObjectId();

  try {
    // ── Test 1: Legacy record without pillars field ─────────────────────────
    await test('Test 1: Legacy FMIHistory record without pillars parses cleanly', async () => {
      // Directly insert legacy document without pillars
      await FMIHistory.collection.insertOne({
        _id: legacyDocId,
        userId: testUserId,
        score: 72,
        factors: ['Factor A', 'Factor B'],
        timestamp: new Date('2025-01-15T10:00:00.000Z'),
        snapshotDate: '2025-01-15'
      });

      const fetched = await FMIHistory.findById(legacyDocId).lean();
      assert(fetched !== null, 'Legacy doc should be found');
      assert.equal(fetched.score, 72);
      assert.equal(fetched.pillars, undefined, 'Legacy doc pillars should be undefined in raw DB');

      const normalized = normalizeFmi(fetched);
      assert.equal(normalized.score, 72);
      assert.equal(normalized.pillars, null, 'normalizeFmi should safely return null for missing pillars');
      assert.deepEqual(normalized.factors, ['Factor A', 'Factor B']);
    });

    // ── Test 2: New record with computed pillars persists properly ──────────
    await test('Test 2: New FMI snapshot persists computed.pillars intact', async () => {
      const mockPillars = {
        D1_savingDiscipline: { score: 85, weight: 0.4, detail: 'Saving 85% of target — on pace' },
        D2_spendingControl:  { score: 90, weight: 0.3, detail: 'Predicted spend is 60% of budget — well controlled' },
        D3_behavioralRisk:   { score: 100, weight: 0.3, detail: 'No risky spending behaviors detected' }
      };

      const newSnapshotDate = '2025-01-16';
      const created = await FMIHistory.findOneAndUpdate(
        { userId: testUserId, snapshotDate: newSnapshotDate },
        {
          $set: {
            score: 88,
            factors: ['FMI: 88/100 (Excellent)'],
            timestamp: new Date('2025-01-16T10:00:00.000Z'),
            snapshotDate: newSnapshotDate,
            pillars: mockPillars
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      assert(created !== null, 'Created doc should exist');
      assert.equal(created.score, 88);
      assert(created.pillars !== null, 'Pillars should be persisted');
      assert.equal(created.pillars.D1_savingDiscipline.score, 85);
      assert.equal(created.pillars.D2_spendingControl.score, 90);
      assert.equal(created.pillars.D3_behavioralRisk.score, 100);

      const normalized = normalizeFmi(created);
      assert.equal(normalized.score, 88);
      assert.deepEqual(normalized.pillars.D1_savingDiscipline, mockPillars.D1_savingDiscipline);
      assert.deepEqual(normalized.pillars.D2_spendingControl, mockPillars.D2_spendingControl);
      assert.deepEqual(normalized.pillars.D3_behavioralRisk, mockPillars.D3_behavioralRisk);
    });

    // ── Test 3: Same-day update preserves and updates pillars idempotently ───
    await test('Test 3: Idempotent same-day update preserves pillars schema', async () => {
      const updatedPillars = {
        D1_savingDiscipline: { score: 92, weight: 0.4, detail: 'Saving 95% of target' },
        D2_spendingControl:  { score: 95, weight: 0.3, detail: 'Well controlled' },
        D3_behavioralRisk:   { score: 100, weight: 0.3, detail: 'Zero risk' }
      };

      const updated = await FMIHistory.findOneAndUpdate(
        { userId: testUserId, snapshotDate: '2025-01-16' },
        {
          $set: {
            score: 93,
            factors: ['FMI: 93/100 (Excellent)'],
            timestamp: new Date('2025-01-16T18:00:00.000Z'),
            pillars: updatedPillars
          }
        },
        { new: true }
      ).lean();

      assert.equal(updated.score, 93);
      assert.equal(updated.pillars.D1_savingDiscipline.score, 92);
      assert.equal(updated.pillars.D2_spendingControl.score, 95);
    });

  } finally {
    // Cleanup test records
    await FMIHistory.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
  }

  console.log();
  console.log('='.repeat(64));
  console.log(`  PILLARS PERSISTENCE TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(64));

  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
