// Refresh-token rotation: one successor per token, overlapping refreshes do not
// end every session, and a failed successor write leaves the old token usable.
// Run: node server/tests/auth/refreshRotation.test.js (needs local MongoDB)
import '../setupEnv.js';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import RefreshToken from '../../models/RefreshToken.js';
import { issueRefreshToken, refreshTokens, hashToken } from '../../services/authService.js';
import { connectTestDB } from '../testDb.js';

const id = 'u-test-refresh-rotation';
const live = () => RefreshToken.countDocuments({ userId: id, isRevoked: false });

await connectTestDB();
await User.deleteMany({ id });
await RefreshToken.deleteMany({ userId: id });
const user = await User.create({ id, name: 'Rotation Test', email: `${id}@finaura.test`, password: 'Rotation#2026' });

try {
  // 1. Two refreshes with the same token at once: one successor, the other gets 409.
  const otherSession = await issueRefreshToken(user);
  const token = await issueRefreshToken(user);
  const results = await Promise.allSettled([refreshTokens(token), refreshTokens(token), refreshTokens(token)]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.equal(ok.length, 1, 'exactly one refresh wins');
  results.filter((r) => r.status === 'rejected').forEach((r) => assert.equal(r.reason.status, 409));
  assert.equal(await RefreshToken.countDocuments({ userId: id }), 3, 'other session, the original and one successor only');
  assert.equal(await live(), 2, 'other session and the single successor stay live');
  console.log('  ✅ simultaneous refreshes produce one successor and keep other sessions');

  // 2. The successor keeps rotating normally.
  const next = await refreshTokens(ok[0].value.refreshToken);
  assert.ok(next.refreshToken);
  console.log('  ✅ the successor rotates');

  // 3. Reuse of a long-rotated token still ends every session.
  await RefreshToken.updateOne({ tokenHash: hashToken(token) }, { $set: { rotatedAt: new Date(Date.now() - 5 * 60 * 1000) } });
  await assert.rejects(refreshTokens(token), (e) => e.status === 401);
  assert.equal(await live(), 0, 'reuse detection revokes all sessions');
  await assert.rejects(refreshTokens(otherSession), (e) => e.status === 401);
  console.log('  ✅ reuse after the grace window revokes everything');

  // 4. Interruption between revoking the old token and writing the successor.
  await RefreshToken.deleteMany({ userId: id });
  const fragile = await issueRefreshToken(user);
  const realCreate = RefreshToken.create;
  RefreshToken.create = async () => { throw new Error('simulated write failure'); };
  try {
    await assert.rejects(refreshTokens(fragile), /simulated write failure/);
  } finally {
    RefreshToken.create = realCreate;
  }
  assert.equal(await live(), 1, 'the old token is live again after a failed successor write');
  const recovered = await refreshTokens(fragile);
  assert.ok(recovered.refreshToken, 'client retries with its current token');
  assert.equal(await live(), 1);
  console.log('  ✅ a failed successor write leaves the client a usable token');

  // 5. Unknown and expired tokens.
  await assert.rejects(refreshTokens('not-a-token'), (e) => e.status === 401);
  const expired = await issueRefreshToken(user);
  await RefreshToken.updateOne({ tokenHash: hashToken(expired) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(refreshTokens(expired), (e) => e.status === 401 && /expired/.test(e.message));
  console.log('  ✅ unknown and expired tokens are refused');

  console.log('\nrefreshRotation: all checks passed');
} finally {
  await User.deleteMany({ id });
  await RefreshToken.deleteMany({ userId: id });
  await mongoose.disconnect();
}
