// Service-level check of the signed-in password change. Run: node server/tests/auth/changePassword.test.js
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import User from '../../models/User.js';
import RefreshToken from '../../models/RefreshToken.js';
import { changePassword, comparePassword, hashPassword, issueRefreshToken } from '../../services/authService.js';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj_test');
const id = 'u-test-change-password';
await User.deleteMany({ id });
await RefreshToken.deleteMany({ userId: id });

const hash = await hashPassword('Old#pass1');
await User.create({ id, name: 'Change Tester', email: 'change.tester@finaura.app', password: hash, passwordHash: hash });
const load = () => User.findOne({ id }).select('+password +passwordHash');
const user = await load();
await issueRefreshToken(user);

await assert.rejects(changePassword(user, 'wrong', 'New#pass2'), /Current password is incorrect/);
await assert.rejects(changePassword(user, 'Old#pass1', 'Old#pass1'), /must be different/);
assert.ok(await comparePassword('Old#pass1', (await load()).password), 'a rejected change leaves the password alone');

await changePassword(user, 'Old#pass1', 'New#pass2');
const after = await load();
assert.ok(await comparePassword('New#pass2', after.password), 'new password works');
assert.ok(!(await comparePassword('Old#pass1', after.password)), 'old password no longer works');
assert.equal(await RefreshToken.countDocuments({ userId: id, isRevoked: false }), 0, 'other sessions are signed out');

await User.deleteMany({ id });
await RefreshToken.deleteMany({ userId: id });
await mongoose.disconnect();
console.log('changePassword: all checks passed');
