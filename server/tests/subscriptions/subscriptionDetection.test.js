/**
 * Recurring-charge detection (services/SubscriptionService.js). Pure function, no database needed.
 */
import assert from 'node:assert/strict';
import { detectRecurring } from '../../services/SubscriptionService.js';

const day = (n) => new Date(Date.UTC(2026, 6, 1) + n * 24 * 60 * 60 * 1000).toISOString();
const tx = (description, amount, n, extra = {}) => ({ description, amount, timestamp: day(n), category: 'Entertainment', type: 'Want', ...extra });

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✅ ${name}`);
}

console.log('SUBSCRIPTION DETECTION TEST SUITE');

test('monthly charge at a steady amount is suggested', () => {
  const [s, ...rest] = detectRecurring([tx('Netflix', 649, 0), tx('Netflix premium', 649, 30), tx('NETFLIX', 649, 61)]);
  assert.equal(rest.length, 0);
  assert.equal(s.key, 'netflix');
  assert.equal(s.frequency, 'monthly');
  assert.equal(s.amount, 649);
  assert.equal(s.occurrences, 3);
  assert.equal(s.nextExpected.slice(0, 10), day(91).slice(0, 10));
});

test('weekly cadence is recognised', () => {
  const [s] = detectRecurring([tx('Gym class', 300, 0), tx('Gym class', 300, 7), tx('Gym class', 310, 14), tx('Gym class', 300, 21)]);
  assert.equal(s.frequency, 'weekly');
});

test('fewer than three charges is not enough evidence', () => {
  assert.deepEqual(detectRecurring([tx('Spotify', 119, 0), tx('Spotify', 119, 30)]), []);
});

test('irregular gaps are rejected', () => {
  assert.deepEqual(detectRecurring([tx('Swiggy', 400, 0), tx('Swiggy', 400, 3), tx('Swiggy', 400, 30), tx('Swiggy', 400, 33)]), []);
});

test('amounts that swing more than 10% are rejected', () => {
  assert.deepEqual(detectRecurring([tx('Uber', 150, 0), tx('Uber', 420, 30), tx('Uber', 90, 60)]), []);
});

test('charges linked to a liability, or matching a liability name, are skipped', () => {
  const linked = [tx('Rent', 18000, 0, { liabilityId: 'L1' }), tx('Rent', 18000, 30, { liabilityId: 'L1' }), tx('Rent', 18000, 60, { liabilityId: 'L1' })];
  assert.deepEqual(detectRecurring(linked), []);
  const named = [tx('Spotify', 119, 0), tx('Spotify', 119, 30), tx('Spotify', 119, 60)];
  assert.deepEqual(detectRecurring(named, [{ name: 'Spotify Family' }]), []);
});

test('suggestions are ordered by amount, largest first', () => {
  const out = detectRecurring([
    tx('Spotify', 119, 0), tx('Spotify', 119, 30), tx('Spotify', 119, 60),
    tx('Broadband', 999, 1), tx('Broadband', 999, 31), tx('Broadband', 999, 61),
  ]);
  assert.deepEqual(out.map((s) => s.key), ['broadband', 'spotify']);
});

console.log(`ALL ${passed} SUBSCRIPTION DETECTION TESTS PASSED`);
