import assert from 'node:assert/strict';
import { smoothPath } from './chartMath.ts';

assert.equal(smoothPath([]), '');
assert.equal(smoothPath([{ x: 1, y: 2 }]), 'M 1 2');
// A straight line stays straight: control points sit on the segment.
assert.equal(smoothPath([{ x: 0, y: 0 }, { x: 6, y: 6 }]), 'M 0 0 C 1 1, 5 5, 6 6');
const path = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
assert.equal(path.split(' C ').length, 3, 'one curve per segment');
assert.ok(path.endsWith('20 10'));
console.log('chartMath ok');
