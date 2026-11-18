import '../setupEnv.js';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import router from '../../controllers/index.js';
import CapturedTransaction from '../../models/CapturedTransaction.js';
import Income from '../../models/Income.js';
import Liability from '../../models/Liability.js';
import PaymentMethod from '../../models/PaymentMethod.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';

const userId = 'sms-qa';
const otherId = 'other-qa';
const debit = 'cap-debit';
const credit = 'cap-credit';
const creditCardId = 'qa-card';
const due = new Date('2026-11-30T06:30:00Z');
const initialState = {
  captures: [
    { _id: 'd1', id: debit, userId, direction: 'debit', status: 'pending' },
    { _id: 'c1', id: credit, userId, direction: 'credit', status: 'pending' },
    { _id: 'd2', id: 'cap-card', userId, direction: 'debit', status: 'pending' },
    { _id: 'd3', id: 'cap-dismissed', userId, direction: 'debit', status: 'dismissed' },
    { _id: 'd4', id: 'cap-legacy', userId, direction: 'debit', status: 'confirmed' },
    { _id: 'd5', id: 'cap-liability', userId, direction: 'debit', status: 'pending' },
  ],
  liability: {
    id: 'qa-rent', userId, status: 'active', autoDeduct: true, frequency: 'monthly',
    dayOfMonth: 30, startDate: new Date('2026-01-30T06:30:00Z'), nextDueDate: due,
  },
  transactions: [],
  incomes: [],
  balance: 5000,
  paidOccurrences: [],
  card: { id: creditCardId, userId, kind: 'credit_card', status: 'active', outstanding: 40, creditLimit: 1000 },
};
const matching = (doc, filter) => Object.entries(filter).every(([key, value]) => key.startsWith('$') || doc[key] === value);
const lean = (doc) => ({ lean: async () => doc });
let state = structuredClone(initialState);
let unsupported = false;
let rejectWrite = false;
let pending = Promise.resolve();

// A serial transaction double checks that every mutation receives the same session
// and that failed writes leave all three documents untouched. The DB suite exercises
// the driver retry and storage behaviour against a real replica set.
mongoose.connection.transaction = (work) => {
  if (unsupported) {
    return Promise.reject(Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 }));
  }

  const operation = pending.then(async () => {
    const session = { state: structuredClone(state) };
    const result = await work(session);
    state = session.state;
    return result;
  });

  pending = operation.catch(() => {});
  return operation;
};

CapturedTransaction.findOne = (filter, _fields, { session }) =>
  lean(session.state.captures.find((item) => matching(item, filter)));
CapturedTransaction.updateOne = async (filter, update, { session }) => {
  const item = session.state.captures.find((capture) => matching(capture, filter));
  if (!item) return { modifiedCount: 0 };
  Object.assign(item, update.$set);
  return { modifiedCount: 1 };
};
User.findOne = async ({ id }) => [userId, otherId].includes(id) ? { id } : null;
User.findOneAndUpdate = async (filter, update, { session }) => {
  if (update.$push) {
    const key = filter.processedLiabilityOccurrences.$ne;
    if (session.state.paidOccurrences.includes(key)) return null;
    session.state.paidOccurrences.push(...update.$push.processedLiabilityOccurrences.$each);
  } else {
    session.state.balance += update.$inc.currentBalance;
  }
  return { id: userId };
};
PaymentMethod.findOne = (filter, _fields, { session }) =>
  lean(matching(session.state.card, filter) ? session.state.card : null);
PaymentMethod.findOneAndUpdate = async (filter, update, { session }) => {
  const card = session.state.card;
  if (!matching(card, filter)) return null;
  card.outstanding += update.$inc.outstanding;
  return card;
};

Liability.findOne = async (filter, _fields, { session }) =>
  matching(session.state.liability, filter) ? session.state.liability : null;
Liability.findOneAndUpdate = async (filter, update, { session }) => {
  const liability = session.state.liability;
  if (!matching(liability, filter)) return null;
  if (filter.$or && liability.processingToken && liability.processingStartedAt > filter.$or[2].processingStartedAt.$lte) return null;
  Object.assign(liability, update.$set);
  for (const key of Object.keys(update.$unset ?? {})) delete liability[key];
  return liability;
};

for (const [Model, key] of [[Transaction, 'transactions'], [Income, 'incomes']]) {
  Model.findOne = (filter, _fields, { session }) =>
    lean(session.state[key].find((entry) => matching(entry, filter)));
  Model.create = async ([fields], { session }) => {
    if (rejectWrite) throw new Error('Injected ledger write failure');
    session.state[key].push(fields);
    return [fields];
  };
}

async function post(path, body, id = userId) {
  const layer = router.stack.find(({ route }) => route?.path === path && route.methods.post);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
  };
  await layer.route.stack.at(-1).handle({ user: { id }, body }, response, (error) => { throw error; });
  return response;
}

const expense = { amount: 250, category: 'Food & Dining', type: 'Want', description: 'Lunch' };
const income = { amount: 2000, source: 'salary', description: 'Salary' };
const confirm = (id, payload = expense, owner = userId) => post('/transactions', { ...payload, capturedId: id }, owner);
const receive = (id) => post('/income', { ...income, capturedId: id });
const statusOf = (id) => state.captures.find((capture) => capture.id === id).status;

assert.equal((await confirm(debit, expense, otherId)).statusCode, 404);
assert.equal((await receive(debit)).statusCode, 409);
assert.equal((await confirm('cap-dismissed')).statusCode, 409);
assert.equal((await confirm('cap-legacy')).statusCode, 409);
assert.equal((await confirm({ id: debit })).statusCode, 400);
assert.deepEqual(state, initialState);

const expenses = await Promise.all([confirm(debit), confirm(debit, { ...expense, amount: 999 })]);
assert.deepEqual(expenses.map((res) => res.statusCode), [201, 200]);
assert.equal(expenses[0].data.id, expenses[1].data.id);
assert.equal(expenses[1].data.amount, 250);
assert.equal(state.balance, 4750);
assert.equal(state.transactions.length, 1);
assert.equal(statusOf(debit), 'confirmed');

rejectWrite = true;
await assert.rejects(receive(credit), /Injected ledger write failure/);
assert.equal(statusOf(credit), 'pending');
assert.equal(state.balance, 4750);
assert.equal(state.incomes.length, 0);

rejectWrite = false;
const credits = await Promise.all([receive(credit), receive(credit)]);
assert.deepEqual(credits.map((res) => res.statusCode), [201, 200]);
assert.equal(credits[0].data.id, credits[1].data.id);
assert.equal(state.balance, 6750);
assert.equal(state.incomes.length, 1);
assert.equal(statusOf(credit), 'confirmed');

unsupported = true;
assert.equal((await confirm('cap-card')).statusCode, 503);
assert.equal(statusOf('cap-card'), 'pending');
assert.equal(state.transactions.length, 1);

unsupported = false;
const cardExpense = { ...expense, paymentMethodId: creditCardId };
assert.equal((await confirm('cap-card', cardExpense)).statusCode, 201);
assert.equal((await confirm('cap-card', cardExpense)).statusCode, 200);
assert.equal(state.card.outstanding, 290);
assert.equal(state.balance, 6750);
assert.equal(state.transactions.length, 2);

const rent = { ...expense, liabilityId: initialState.liability.id, expectedScheduledFor: due.toISOString() };
state.liability.processingToken = 'scheduler-claim';
state.liability.processingScheduledFor = due;
state.liability.processingStartedAt = new Date();
const beforeRent = structuredClone(state);
assert.equal((await confirm('cap-liability', rent)).statusCode, 409);
assert.deepEqual(state, beforeRent, 'an SMS cannot debit an occurrence claimed by the scheduler');
delete state.liability.processingToken;
delete state.liability.processingScheduledFor;
delete state.liability.processingStartedAt;

rejectWrite = true;
const beforeFailure = structuredClone(state);
await assert.rejects(confirm('cap-liability', rent), /Injected ledger write failure/);
assert.deepEqual(state, beforeFailure, 'the capture, payment marker, claim and debit all roll back');
rejectWrite = false;

const firstRent = await confirm('cap-liability', rent);
const nextDueDate = state.liability.nextDueDate.getTime();
assert.equal(firstRent.statusCode, 201);
assert.ok(nextDueDate > due.getTime());
assert.deepEqual(state.paidOccurrences, [`${rent.liabilityId}:${due.toISOString()}`]);
assert.equal(state.liability.processingToken, undefined);
const repeatedRent = await confirm('cap-liability', rent);
assert.equal(repeatedRent.statusCode, 200);
assert.equal(firstRent.data.id, repeatedRent.data.id);
assert.equal(state.liability.nextDueDate.getTime(), nextDueDate);
assert.equal(state.balance, 6500);

console.log('SMS confirmation passed: ownership, direction, dismissal, legacy, concurrent replay, rollback, card, scheduled payment, standalone.');
