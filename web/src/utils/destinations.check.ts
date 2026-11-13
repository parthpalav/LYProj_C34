// Run: node --experimental-strip-types src/utils/destinations.check.ts
import assert from 'node:assert/strict';
import { DESTINATIONS, searchDestinations } from './destinations.ts';

assert.equal(searchDestinations('').length, DESTINATIONS.length, 'empty query lists everything');
assert.equal(searchDestinations('  PASSWORD ')[0]?.to, '/app/settings', 'keywords match, case and spaces ignored');
assert.equal(searchDestinations('csv download')[0]?.to, '/app/reports?tab=export', 'all words must match');
assert.equal(searchDestinations('zzzz').length, 0, 'no match gives an empty list');
assert.equal(new Set(DESTINATIONS.map((d) => d.to)).size, DESTINATIONS.length, 'no duplicate targets');
assert.ok(DESTINATIONS.every((d) => d.to.startsWith('/app')), 'every target is inside the app shell');
console.log('destinations: ok');
