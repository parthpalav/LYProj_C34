import assert from 'node:assert/strict';
import { monotonePath, sliceAt, smoothPath } from './chartMath.ts';

assert.equal(smoothPath([]), '');
assert.equal(smoothPath([{ x: 1, y: 2 }]), 'M 1 2');
// A straight line stays straight: control points sit on the segment.
assert.equal(smoothPath([{ x: 0, y: 0 }, { x: 6, y: 6 }]), 'M 0 0 C 1 1, 5 5, 6 6');
const path = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
assert.equal(path.split(' C ').length, 3, 'one curve per segment');
assert.ok(path.endsWith('20 10'));
// Monotone path: every control point stays within its segment's y-span, so spikes never overshoot.
const spiky = [0, 0, 100, 0, 0, 40, 45, 0].map((y, i) => ({ x: i * 10, y }));
const mono = monotonePath(spiky);
const nums = mono.replace(/[MC,]/g, ' ').trim().split(/\s+/).map(Number);
const ys = nums.filter((_, i) => i % 2 === 1);
assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 100, `overshoot in ${mono}`);
assert.equal(mono.split(' C ').length, spiky.length, 'one curve per segment');
assert.equal(monotonePath([{ x: 0, y: 5 }, { x: 4, y: 1 }]), 'M 0 5 L 4 1');
assert.equal(monotonePath([]), '');
// Donut hit-testing: slices run clockwise from 12 o'clock (dy is negative above the centre).
const half = [{ value: 50 }, { value: 25 }, { value: 25 }];
assert.equal(sliceAt(10, -1, half), 0, 'just right of 12 o\'clock');
assert.equal(sliceAt(10, 10, half), 0, 'lower right is still the first half');
assert.equal(sliceAt(-10, 10, half), 1, 'lower left quarter');
assert.equal(sliceAt(-10, -10, half), 2, 'upper left quarter');
assert.equal(sliceAt(1, 1, [{ value: 0 }]), -1, 'nothing to pick');
console.log('chartMath ok');
