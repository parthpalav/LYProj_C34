/**
 * The FMI screen (GET /api/fmi) and the assistant context must score the same
 * profile the same way: one retirement-target rule and one income resolver.
 *
 * Run: node server/tests/fmi/fmiInputParity.test.js (needs local MongoDB)
 */
import '../setupEnv.js';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Goal from '../../models/Goal.js';
import Income from '../../models/Income.js';
import Transaction from '../../models/Transaction.js';
import controllerRouter from '../../controllers/index.js';
import { buildChatContext } from '../../services/ChatContextService.js';
import { connectTestDB } from '../testDb.js';

const USER = 'u-test-fmi-parity';
const own = { userId: USER };
const DAY = 86400000;

function fmiApi() {
  const layer = controllerRouter.stack.find((l) => l.route?.path === '/fmi' && l.route.methods.get);
  return new Promise((resolve, reject) => {
    layer.route.stack.at(-1).handle({ user: { id: USER }, params: {}, query: {}, body: {} },
      { status() { return this; }, json: resolve }, (e) => (e ? reject(e) : resolve(null)));
  });
}

async function reset(profile) {
  await Promise.all([User.deleteMany({ id: USER }), Goal.deleteMany(own), Income.deleteMany(own), Transaction.deleteMany(own)]);
  await User.create({
    id: USER, name: 'Parity', email: `${USER}@finaura.test`, timezone: 'Asia/Kolkata',
    dateOfBirth: new Date(`${new Date().getFullYear() - 25}-01-01`), retirementAge: 60,
    monthlyIncome: 40000, currentBalance: 10000, incomeType: 'salaried', ...profile,
  });
}

async function run() {
  await connectTestDB();

  // Retirement target precedence: Retirement goal > profile corpus > 20 × annual income.
  await reset({ retirementCorpusGoal: 4200000 });
  let api = await fmiApi();
  assert.equal(api.goalDetail.retirementGoal, 4200000, 'profile corpus is used before estimating');
  assert.equal(api.requiredMonthlySaving, Math.round((4200000 - 10000) / 420), 'required saving uses the saved target (₹9,976)');
  let chat = await buildChatContext(USER);
  assert.equal(chat.fmi.requiredMonthlySaving, api.requiredMonthlySaving, 'assistant uses the same target');

  await Goal.create({ id: 'g-parity-ret', userId: USER, name: 'Retirement', targetAmount: 5000000, savedAmount: 0 });
  api = await fmiApi();
  assert.equal(api.goalDetail.retirementGoal, 5000000, 'an explicit Retirement goal wins');
  chat = await buildChatContext(USER);
  assert.equal(chat.fmi.requiredMonthlySaving, api.requiredMonthlySaving);

  await reset({ retirementCorpusGoal: 0 });
  api = await fmiApi();
  assert.equal(api.goalDetail.retirementGoal, 40000 * 12 * 20, 'estimate only when nothing is saved');
  console.log('  ✅ one retirement-target rule across FMI and assistant');

  // Freelancer: the FMI screen and the assistant resolve income the same way.
  const cases = [
    ['recent earned income', [{ amount: 5000, source: 'freelance', daysAgo: 5 }]],
    ['old income only', [{ amount: 30000, source: 'freelance', daysAgo: 60 }]],
    ['reimbursement only', [{ amount: 2000, source: 'reimbursement', daysAgo: 3 }]],
  ];
  for (const [label, incomes] of cases) {
    await reset({ incomeType: 'freelancer', retirementCorpusGoal: 4200000 });
    await Income.insertMany(incomes.map((i, n) => ({ id: `i-parity-${n}`, userId: USER, amount: i.amount, source: i.source, timestamp: new Date(Date.now() - i.daysAgo * DAY) })));
    await Transaction.create({ id: 't-parity-spend', userId: USER, amount: 10000, category: 'Shopping', type: 'Want', description: 'month spend', timestamp: new Date(Date.now() - 60000) });
    api = await fmiApi();
    chat = await buildChatContext(USER);
    assert.equal(chat.fmi.score, api.score, `${label}: assistant FMI ${chat.fmi.score} vs screen ${api.score}`);
    assert.equal(chat.fmi.pillars.spendingControl, api.pillars.D2_spendingControl.score, `${label}: spending-control pillar differs`);
    assert.equal(chat.fmi.pillars.savingDiscipline, api.pillars.D1_savingDiscipline.score, `${label}: saving pillar differs`);
    assert.equal(chat.fmi.requiredMonthlySaving, api.requiredMonthlySaving, `${label}: required saving differs`);
  }
  console.log('  ✅ freelancer FMI matches between screen and assistant (recent, old-only, reimbursement-only income)');

  // A future-dated expense has not happened yet: it is not part of this month's FMI.
  await reset({});
  await Transaction.create({ id: 't-parity-now', userId: USER, amount: 1000, category: 'Groceries', type: 'Need', description: 'today', timestamp: new Date(Date.now() - 60000) });
  await Transaction.create({ id: 't-parity-future', userId: USER, amount: 9000, category: 'Shopping', type: 'Want', description: 'scheduled later', timestamp: new Date(Date.now() + 3600000) });
  api = await fmiApi();
  chat = await buildChatContext(USER);
  assert.equal(api.totalSpent, 1000, 'FMI ignores a future-dated expense');
  assert.equal(chat.fmi.score, api.score);
  console.log('  ✅ future-dated expenses stay out of the current FMI');

  await Promise.all([User.deleteMany({ id: USER }), Goal.deleteMany(own), Income.deleteMany(own), Transaction.deleteMany(own)]);
  await mongoose.disconnect();
  console.log('\nfmiInputParity: all checks passed');
}

run().catch(async (err) => {
  console.error('❌', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
