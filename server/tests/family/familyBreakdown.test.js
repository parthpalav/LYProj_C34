/**
 * Family member breakdown: Shapley score attribution + amount visibility.
 *  1. shapleyValues: additive game gives each player its own value; symmetric players split evenly
 *  2. member points sum to the family raw score, and round to the family FMI score
 *  3. pillar points sum to each member's points
 *  4. one-member family gets the whole score
 *  5. owner sees every member's amounts; a member sees only their own
 *  6. GET /api/family/dashboard carries memberBreakdown, fmi stays attribution-free
 */
import '../setupEnv.js';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import routes from '../../routes/index.js';
import { connectDB } from '../../config/db.js';
import User from '../../models/User.js';
import Family from '../../models/Family.js';
import Transaction from '../../models/Transaction.js';
import Income from '../../models/Income.js';
import { shapleyValues } from '../../utils/shapley.js';
import { getHouseholdData } from '../../services/FamilyAggregationService.js';
import { getFamilyFMI, buildMemberBreakdown } from '../../services/FamilyFMIService.js';

let passed = 0;
async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  await fn();
  passed++;
  console.log('✅ Passed');
}
const close = (a, b, eps = 0.051) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

async function run() {
  await test('1. shapleyValues on known games', async () => {
    const own = { a: 10, b: 20, c: 5 };
    const additive = shapleyValues(['a', 'b', 'c'], (s) => ({ v: s.reduce((t, p) => t + own[p], 0) }));
    assert.deepEqual(additive.map((x) => Math.round(x.v * 1e9) / 1e9), [10, 20, 5]);
    // Glove game style: value 1 only when both players are present
    const pair = shapleyValues(['x', 'y'], (s) => ({ v: s.length === 2 ? 1 : 0 }));
    assert.deepEqual(pair.map((x) => x.v), [0.5, 0.5]);
  });

  await connectDB();
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/family`;

  const ts = Date.now();
  const ids = { owner: `u-brk-o-${ts}`, kid: `u-brk-k-${ts}`, solo: `u-brk-s-${ts}` };
  const all = Object.values(ids);
  const cleanup = async () => {
    await User.deleteMany({ id: { $in: all } });
    await Family.deleteMany({ 'members.userId': { $in: all } });
    await Transaction.deleteMany({ userId: { $in: all } });
    await Income.deleteMany({ userId: { $in: all } });
  };
  const token = (id) => jwt.sign({ id, email: `${id}@test.com`, name: id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  try {
    await cleanup();
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 15), 12);
    await User.create([
      { id: ids.owner, name: 'Owner', email: `${ids.owner}@test.com`, monthlyIncome: 100000, currentBalance: 200000, retirementAge: 60, age: 45 },
      { id: ids.kid, name: 'Kid', email: `${ids.kid}@test.com`, monthlyIncome: 10000, currentBalance: 5000, retirementAge: 60, age: 20 },
      { id: ids.solo, name: 'Solo', email: `${ids.solo}@test.com`, monthlyIncome: 50000, currentBalance: 0, retirementAge: 60, age: 30 },
    ]);
    await Family.create({
      name: 'Breakdown Family', ownerUserId: ids.owner, isActive: true,
      members: [{ userId: ids.owner, role: 'owner', joinedAt: now }, { userId: ids.kid, role: 'member', joinedAt: now }],
    });
    await Family.create({ name: 'Solo Family', ownerUserId: ids.solo, isActive: true, members: [{ userId: ids.solo, role: 'owner', joinedAt: now }] });
    const tx = (userId, n, amount, type, category) => ({ id: `tx-brk-${n}-${ts}`, userId, amount, type, category, timestamp: mid });
    await Transaction.create([
      tx(ids.owner, 1, 30000, 'Need', 'Housing'),
      tx(ids.owner, 2, 8000, 'Want', 'Food & Dining'),
      tx(ids.owner, 3, 25000, 'Investment', 'Investments'),
      tx(ids.kid, 4, 2000, 'Need', 'Transport & Travel'),
      tx(ids.kid, 5, 7000, 'Want', 'Shopping'),
      tx(ids.kid, 6, 3000, 'Want', 'Entertainment'),
      tx(ids.solo, 7, 20000, 'Need', 'Housing'),
      tx(ids.solo, 8, 5000, 'Investment', 'Investments'),
    ]);

    const household = await getHouseholdData(ids.owner);
    const fmi = await getFamilyFMI(ids.owner, household.summary);
    const ownerView = await buildMemberBreakdown(ids.owner, household);

    await test('2. member points sum to raw score and round to the family FMI', async () => {
      const sum = ownerView.members.reduce((s, m) => s + m.score.points, 0);
      close(sum, ownerView.rawScore, 0.11);
      assert.equal(Math.round(ownerView.rawScore), fmi.score);
      const pctSum = ownerView.members.reduce((s, m) => s + m.score.pctOfScore, 0);
      close(pctSum, 100, 0.2);
    });

    await test('3. pillar points sum to member points', async () => {
      for (const m of ownerView.members) {
        const { D1, D2, D3 } = m.score.pillars;
        close(D1 + D2 + D3, m.score.points, 0.16);
      }
    });

    await test('4. one-member family gets the whole score', async () => {
      const soloData = await getHouseholdData(ids.solo);
      const soloFmi = await getFamilyFMI(ids.solo, soloData.summary);
      const solo = await buildMemberBreakdown(ids.solo, soloData);
      assert.equal(solo.members.length, 1);
      assert.equal(Math.round(solo.members[0].score.points), soloFmi.score);
      assert.equal(solo.members[0].score.pctOfScore, 100);
    });

    await test('5. owner sees all amounts; member sees only own', async () => {
      assert.equal(ownerView.viewerCanSeeAllAmounts, true);
      assert.ok(ownerView.members.every((m) => m.amounts));
      const kidRow = ownerView.members.find((m) => m.userId === ids.kid);
      assert.equal(kidRow.amounts.want, 10000);
      assert.equal(kidRow.shares.wantPct, Math.round((10000 / 18000) * 1000) / 10);

      const kidView = await buildMemberBreakdown(ids.kid, household);
      assert.equal(kidView.viewerCanSeeAllAmounts, false);
      const own = kidView.members.find((m) => m.isYou);
      const other = kidView.members.find((m) => !m.isYou);
      assert.ok(own.amounts);
      assert.equal(other.amounts, undefined);
      assert.ok(other.shares && other.score, 'shares and points still visible');
      assert.ok(!JSON.stringify(other).includes('30000'), 'no rupee figures for others');
    });

    await test('6. dashboard API carries memberBreakdown; fmi stays clean', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, { headers: { Authorization: `Bearer ${token(ids.kid)}` } });
      const json = await res.json();
      assert.equal(json.memberBreakdown.method, 'shapley');
      assert.equal(json.memberBreakdown.members.find((m) => !m.isYou).amounts, undefined);
      assert.ok(!JSON.stringify(json.fmi).includes(ids.kid));
    });

    console.log(`  ALL ${passed} FAMILY BREAKDOWN TESTS PASSED`);
  } finally {
    await cleanup();
    server.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => { console.error('❌', err); process.exit(1); });
