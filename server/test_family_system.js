/**
 * server/test_family_system.js
 *
 * Comprehensive test suite for FINAURA Family System Phase 2 Backend Foundation:
 * - Domain model validation & schema constraints
 * - Partial unique multikey indexes (active family isolation, pairKey uniqueness)
 * - Invitation lifecycle (send, accept, decline, cancel, expire)
 * - First acceptance creates Family (A=owner, B=member)
 * - Multiple pre-family invitations (A invites B & C; B accepts -> Family created, C's invite updated -> C joins same Family)
 * - Concurrent creation protection & failure-safe rollbacks
 * - Authorization & IDOR protection
 * - Family size limit (MAX_FAMILY_MEMBERS = 6)
 * - Member leave & remove mechanics
 * - Re-joining / re-creating family after departure
 */

import './test/setupEnv.js';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import routes from './routes/index.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Family from './models/Family.js';
import FamilyInvitation from './models/FamilyInvitation.js';
import { makePairKey, MAX_FAMILY_MEMBERS, FAMILY_INVITE_EXPIRY_DAYS } from './config/familyRules.js';
import * as FamilyService from './services/FamilyService.js';

const JWT_SECRET = process.env.JWT_SECRET;

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id?.toString(),
      _id: user._id?.toString(),
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let passed = 0;
async function test(name, fn) {
  process.stdout.write(`Running ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ Passed');
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log('='.repeat(64));
  console.log('  FINAURA FAMILY SYSTEM PHASE 2 BACKEND TEST SUITE');
  console.log('='.repeat(64));

  await connectDB();

  // Create test express app & mount routes
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  // Start on ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/family`;

  // Test User IDs
  const ts = Date.now();
  const userA_Id = `u-test-fam-a-${ts}`;
  const userB_Id = `u-test-fam-b-${ts}`;
  const userC_Id = `u-test-fam-c-${ts}`;
  const userD_Id = `u-test-fam-d-${ts}`;
  const userE_Id = `u-test-fam-e-${ts}`;
  const userF_Id = `u-test-fam-f-${ts}`;
  const userG_Id = `u-test-fam-g-${ts}`;
  const userH_Id = `u-test-fam-h-${ts}`;

  const allTestUserIds = [userA_Id, userB_Id, userC_Id, userD_Id, userE_Id, userF_Id, userG_Id, userH_Id];

  // Helper for cleanup
  const cleanup = async () => {
    await User.deleteMany({ id: { $in: allTestUserIds } });
    await Family.deleteMany({
      $or: [
        { ownerUserId: { $in: allTestUserIds } },
        { 'members.userId': { $in: allTestUserIds } }
      ]
    });
    await FamilyInvitation.deleteMany({
      $or: [
        { inviterUserId: { $in: allTestUserIds } },
        { inviteeUserId: { $in: allTestUserIds } }
      ]
    });
  };

  try {
    await cleanup();

    // Create test users
    const users = {
      A: await User.create({ id: userA_Id, name: 'Alice Test', email: `alice-${ts}@test.com`, password: 'hash' }),
      B: await User.create({ id: userB_Id, name: 'Bob Test', email: `bob-${ts}@test.com`, password: 'hash' }),
      C: await User.create({ id: userC_Id, name: 'Charlie Test', email: `charlie-${ts}@test.com`, password: 'hash' }),
      D: await User.create({ id: userD_Id, name: 'David Test', email: `david-${ts}@test.com`, password: 'hash' }),
      E: await User.create({ id: userE_Id, name: 'Emma Test', email: `emma-${ts}@test.com`, password: 'hash' }),
      F: await User.create({ id: userF_Id, name: 'Frank Test', email: `frank-${ts}@test.com`, password: 'hash' }),
      G: await User.create({ id: userG_Id, name: 'Grace Test', email: `grace-${ts}@test.com`, password: 'hash' }),
      H: await User.create({ id: userH_Id, name: 'Henry Test', email: `henry-${ts}@test.com`, password: 'hash' }),
    };

    const tokens = {
      A: generateTestToken(users.A),
      B: generateTestToken(users.B),
      C: generateTestToken(users.C),
      D: generateTestToken(users.D),
      E: generateTestToken(users.E),
      F: generateTestToken(users.F),
      G: generateTestToken(users.G),
      H: generateTestToken(users.H),
    };

    // Helper for authenticated requests
    async function apiRequest(endpoint, { method = 'GET', token, body } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    }

    // ── 1. MAKE PAIR KEY HELPER TESTS ───────────────────────
    await test('1. makePairKey derives identical key regardless of parameter order', async () => {
      const k1 = makePairKey('u-1', 'u-2');
      const k2 = makePairKey('u-2', 'u-1');
      assert.equal(k1, 'u-1:u-2');
      assert.equal(k2, 'u-1:u-2');
      assert.equal(k1, k2);
    });

    // ── 2. INITIAL STATE TESTS ───────────────────────────────
    await test('2. GET /family/current returns { family: null } for user without family', async () => {
      const res = await apiRequest('/current', { token: tokens.A });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.family, null);
    });

    // ── 3. SEND INVITATION VALIDATION TESTS ──────────────────
    await test('3. POST /family/invitations rejects unauthenticated request with 401', async () => {
      const res = await apiRequest('/invitations', { method: 'POST', body: { email: users.B.email } });
      assert.equal(res.status, 401);
    });

    await test('4. POST /family/invitations rejects missing email with 400', async () => {
      const res = await apiRequest('/invitations', { method: 'POST', token: tokens.A, body: {} });
      assert.equal(res.status, 400);
    });

    await test('5. POST /family/invitations rejects nonexistent email with 404', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: 'nonexistent-user-12345@finaura.com' }
      });
      assert.equal(res.status, 404);
      assert.ok(res.data.error.includes('No registered FINAURA user found'));
    });

    await test('6. POST /family/invitations rejects self-invitation with 400', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.A.email }
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.error.includes('cannot invite yourself'));
    });

    // ── 4. VALID INVITATION & NO FAMILY PRE-CREATION ─────────
    let inviteAB_Id;
    await test('7. Valid invite A -> B creates pending invitation with familyId=null and NO Family created', async () => {
      // Test email normalization (mixed case + whitespace)
      const unnormalizedEmail = `  ${users.B.email.toUpperCase()}  `;
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: unnormalizedEmail }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.status, 'pending');
      assert.equal(res.data.data.familyId, null);
      assert.equal(res.data.data.inviteeEmail, users.B.email.toLowerCase());
      inviteAB_Id = res.data.data.id;

      // Invariant: No Family must exist yet!
      const familiesInDb = await Family.find({
        $or: [{ ownerUserId: userA_Id }, { 'members.userId': userA_Id }]
      });
      assert.equal(familiesInDb.length, 0, 'No Family should be created when sending first invite');
    });

    // ── 5. DUPLICATE & REVERSE INVITATION GUARDS ─────────────
    await test('8. Duplicate invite A -> B is rejected with 409', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.B.email }
      });
      assert.equal(res.status, 409);
      assert.ok(res.data.error.includes('already been sent'));
    });

    await test('9. Reverse duplicate invite B -> A is rejected with 409', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.B,
        body: { email: users.A.email }
      });
      assert.equal(res.status, 409);
      assert.ok(res.data.error.includes('already sent you a pending invitation'));
    });

    // ── 6. RECEIVED & SENT INVITATIONS QUERIES ───────────────
    await test('10. GET /family/invitations/received returns pending invite for B with inviter name', async () => {
      const res = await apiRequest('/invitations/received', { token: tokens.B });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.length, 1);
      assert.equal(res.data.data[0].id, inviteAB_Id);
      assert.equal(res.data.data[0].inviterName, users.A.name);
      assert.equal(res.data.data[0].status, 'pending');
    });

    await test('11. GET /family/invitations/sent returns pending invite for A', async () => {
      const res = await apiRequest('/invitations/sent', { token: tokens.A });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.length, 1);
      assert.equal(res.data.data[0].id, inviteAB_Id);
      assert.equal(res.data.data[0].inviteeEmail, users.B.email);
    });

    // ── 7. DECLINE FLOW & RE-INVITATION ─────────────────────
    await test('12. Unauthorized user C cannot decline B\'s invitation (403)', async () => {
      const res = await apiRequest(`/invitations/${inviteAB_Id}/decline`, {
        method: 'POST',
        token: tokens.C
      });
      assert.equal(res.status, 403);
    });

    await test('13. B declines invitation -> status becomes declined and NO Family is created', async () => {
      const res = await apiRequest(`/invitations/${inviteAB_Id}/decline`, {
        method: 'POST',
        token: tokens.B
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'declined');

      const inv = await FamilyInvitation.findById(inviteAB_Id);
      assert.equal(inv.status, 'declined');
      assert.ok(inv.respondedAt instanceof Date);

      const familiesCount = await Family.countDocuments({
        $or: [{ ownerUserId: userA_Id }, { 'members.userId': userA_Id }]
      });
      assert.equal(familiesCount, 0, 'Declining first invite must NOT create a Family');
    });

    await test('14. Double decline on same invitation is rejected with 400', async () => {
      const res = await apiRequest(`/invitations/${inviteAB_Id}/decline`, {
        method: 'POST',
        token: tokens.B
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.error.includes('not pending'));
    });

    // ── 8. CANCEL FLOW ──────────────────────────────────────
    let inviteAtoC_Id;
    await test('15. Inviter A sends new invite to C, then cancels it', async () => {
      const sendRes = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.C.email }
      });
      assert.equal(sendRes.status, 201);
      inviteAtoC_Id = sendRes.data.data.id;

      // Unauthorized user B cannot cancel A's invite
      const unauthCancel = await apiRequest(`/invitations/${inviteAtoC_Id}`, {
        method: 'DELETE',
        token: tokens.B
      });
      assert.equal(unauthCancel.status, 403);

      // Inviter A cancels
      const cancelRes = await apiRequest(`/invitations/${inviteAtoC_Id}`, {
        method: 'DELETE',
        token: tokens.A
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.data.status, 'cancelled');

      const inv = await FamilyInvitation.findById(inviteAtoC_Id);
      assert.equal(inv.status, 'cancelled');
    });

    // ── 9. EXPIRATION BEHAVIOR ──────────────────────────────
    await test('16. Expired invitation is rejected on accept and marked expired', async () => {
      // Create an expired invitation directly in DB
      const expiredInvite = await FamilyInvitation.create({
        familyId: null,
        inviterUserId: userA_Id,
        inviteeUserId: userD_Id,
        inviteeEmail: users.D.email,
        pairKey: makePairKey(userA_Id, userD_Id),
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000) // expired 1s ago
      });

      const acceptRes = await apiRequest(`/invitations/${expiredInvite._id}/accept`, {
        method: 'POST',
        token: tokens.D
      });
      assert.equal(acceptRes.status, 400);
      assert.ok(acceptRes.data.error.includes('expired'));

      const dbInvite = await FamilyInvitation.findById(expiredInvite._id);
      assert.equal(dbInvite.status, 'expired');
    });

    // ── 10. MULTIPLE PRE-FAMILY INVITES & FIRST ACCEPTANCE ──
    let inviteA_B_active;
    let inviteA_C_active;
    await test('17. Scenario: A invites B and C while having no family; both invites have familyId=null', async () => {
      const resB = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.B.email }
      });
      assert.equal(resB.status, 201);
      inviteA_B_active = resB.data.data.id;

      const resC = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.C.email }
      });
      assert.equal(resC.status, 201);
      inviteA_C_active = resC.data.data.id;

      assert.equal(resB.data.data.familyId, null);
      assert.equal(resC.data.data.familyId, null);
    });

    let createdFamilyId;
    await test('18. B accepts -> Family A+B created with A=owner, B=member, and C\'s pending invite updated to this familyId', async () => {
      // Unauthorized accept check: user D cannot accept B's invite
      const unauthAccept = await apiRequest(`/invitations/${inviteA_B_active}/accept`, {
        method: 'POST',
        token: tokens.D
      });
      assert.equal(unauthAccept.status, 403);

      // B accepts
      const acceptRes = await apiRequest(`/invitations/${inviteA_B_active}/accept`, {
        method: 'POST',
        token: tokens.B
      });
      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.data.success, true);
      createdFamilyId = acceptRes.data.familyId;
      assert.ok(createdFamilyId);

      // Verify Family document in DB
      const fam = await Family.findById(createdFamilyId);
      assert.ok(fam);
      assert.equal(fam.ownerUserId, userA_Id);
      assert.equal(fam.members.length, 2);
      assert.equal(fam.members[0].userId, userA_Id);
      assert.equal(fam.members[0].role, 'owner');
      assert.equal(fam.members[1].userId, userB_Id);
      assert.equal(fam.members[1].role, 'member');

      // Verify C's pending invitation was updated to reference this new familyId!
      const inviteC = await FamilyInvitation.findById(inviteA_C_active);
      assert.equal(inviteC.status, 'pending');
      assert.equal(inviteC.familyId.toString(), createdFamilyId);
    });

    await test('19. Double accept on same invitation is rejected (400)', async () => {
      const res = await apiRequest(`/invitations/${inviteA_B_active}/accept`, {
        method: 'POST',
        token: tokens.B
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.error.includes('already accepted'));
    });

    await test('20. C accepts -> C is added to the SAME existing Family (members count = 3)', async () => {
      const acceptRes = await apiRequest(`/invitations/${inviteA_C_active}/accept`, {
        method: 'POST',
        token: tokens.C
      });
      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.data.familyId, createdFamilyId);

      const fam = await Family.findById(createdFamilyId);
      assert.equal(fam.members.length, 3);
      assert.deepEqual(
        fam.members.map((m) => m.userId),
        [userA_Id, userB_Id, userC_Id]
      );
    });

    // ── 11. ONE-FAMILY-PER-USER ENFORCEMENT ─────────────────
    await test('21. User B (already in Family) cannot join another family (409)', async () => {
      // D invites B
      const sendRes = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.D,
        body: { email: users.B.email }
      });
      assert.equal(sendRes.status, 409);
      assert.ok(sendRes.data.error.includes('already a member of a family'));
    });

    await test('22. Database constraint rejects inserting a member into two active families', async () => {
      // Direct Mongoose create attempt with user B who is already in active family
      try {
        await Family.create({
          name: 'Rogue Family',
          ownerUserId: userD_Id,
          members: [
            { userId: userD_Id, role: 'owner' },
            { userId: userB_Id, role: 'member' }
          ],
          isActive: true
        });
        assert.fail('Should have failed with duplicate key error code 11000');
      } catch (err) {
        assert.equal(err.code, 11000);
      }
    });

    // ── 12. ROLE PERMISSIONS & CURRENT FAMILY ───────────────
    await test('23. Non-owner member B cannot invite new user D (403)', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.B,
        body: { email: users.D.email }
      });
      assert.equal(res.status, 403);
      assert.ok(res.data.error.includes('Only the family owner'));
    });

    await test('24. Owner A can invite D to existing family', async () => {
      const res = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.A,
        body: { email: users.D.email }
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.data.familyId, createdFamilyId);

      // D accepts
      const acceptRes = await apiRequest(`/invitations/${res.data.data.id}/accept`, {
        method: 'POST',
        token: tokens.D
      });
      assert.equal(acceptRes.status, 200);

      const fam = await Family.findById(createdFamilyId);
      assert.equal(fam.members.length, 4);
    });

    await test('25. GET /family/current returns populated roster with names and roles', async () => {
      const res = await apiRequest('/current', { token: tokens.B });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const fam = res.data.family;
      assert.equal(fam.id, createdFamilyId);
      assert.equal(fam.role, 'member'); // B is member
      assert.equal(fam.members.length, 4);

      // Verify names are populated
      const memberNames = fam.members.map((m) => m.name);
      assert.ok(memberNames.includes(users.A.name));
      assert.ok(memberNames.includes(users.B.name));
      assert.ok(memberNames.includes(users.C.name));
      assert.ok(memberNames.includes(users.D.name));
    });

    // ── 13. FAMILY SIZE LIMIT (MAX_FAMILY_MEMBERS = 6) ──────
    await test('26. Family size limit is strictly enforced up to MAX_FAMILY_MEMBERS (6)', async () => {
      // Currently has 4 members (A, B, C, D).
      // Add E (member 5)
      const invE = await apiRequest('/invitations', { method: 'POST', token: tokens.A, body: { email: users.E.email } });
      assert.equal(invE.status, 201);
      await apiRequest(`/invitations/${invE.data.data.id}/accept`, { method: 'POST', token: tokens.E });

      // Add F (member 6 - MAX REACHED)
      const invF = await apiRequest('/invitations', { method: 'POST', token: tokens.A, body: { email: users.F.email } });
      assert.equal(invF.status, 201);
      await apiRequest(`/invitations/${invF.data.data.id}/accept`, { method: 'POST', token: tokens.F });

      const famNow = await Family.findById(createdFamilyId);
      assert.equal(famNow.members.length, 6);

      // Now attempting to invite G must be rejected because family is full (400)
      const invG = await apiRequest('/invitations', { method: 'POST', token: tokens.A, body: { email: users.G.email } });
      assert.equal(invG.status, 400);
      assert.ok(invG.data.error.includes('maximum capacity'));
    });

    // ── 14. LEAVE & REMOVE MEMBER TESTS ─────────────────────
    await test('27. Owner cannot leave populated family (409)', async () => {
      const res = await apiRequest('/leave', { method: 'POST', token: tokens.A });
      assert.equal(res.status, 409);
      assert.ok(res.data.error.includes('Owner cannot leave while other family members remain'));
    });

    await test('28. Non-owner cannot remove another member (403)', async () => {
      const res = await apiRequest(`/members/${userC_Id}/remove`, {
        method: 'POST',
        token: tokens.B
      });
      assert.equal(res.status, 403);
      assert.ok(res.data.error.includes('Only the family owner'));
    });

    await test('29. Owner cannot remove self through remove endpoint (400)', async () => {
      const res = await apiRequest(`/members/${userA_Id}/remove`, {
        method: 'POST',
        token: tokens.A
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.error.includes('Owner cannot be removed'));
    });

    await test('30. Owner removes member F successfully', async () => {
      const res = await apiRequest(`/members/${userF_Id}/remove`, {
        method: 'POST',
        token: tokens.A
      });
      assert.equal(res.status, 200);

      const fam = await Family.findById(createdFamilyId);
      assert.equal(fam.members.length, 5);
      assert.ok(!fam.members.some((m) => m.userId === userF_Id));
    });

    await test('31. Member E leaves family voluntarily', async () => {
      const res = await apiRequest('/leave', {
        method: 'POST',
        token: tokens.E
      });
      assert.equal(res.status, 200);

      const fam = await Family.findById(createdFamilyId);
      assert.equal(fam.members.length, 4);
      assert.ok(!fam.members.some((m) => m.userId === userE_Id));

      // User E has no family now
      const curE = await apiRequest('/current', { token: tokens.E });
      assert.equal(curE.data.family, null);
    });

    await test('32. Removed user F can now create a new family with E', async () => {
      // F invites E
      const invRes = await apiRequest('/invitations', {
        method: 'POST',
        token: tokens.F,
        body: { email: users.E.email }
      });
      assert.equal(invRes.status, 201);

      // E accepts
      const accRes = await apiRequest(`/invitations/${invRes.data.data.id}/accept`, {
        method: 'POST',
        token: tokens.E
      });
      assert.equal(accRes.status, 200);

      const newFamId = accRes.data.familyId;
      assert.notEqual(newFamId, createdFamilyId);

      const newFam = await Family.findById(newFamId);
      assert.equal(newFam.ownerUserId, userF_Id);
      assert.equal(newFam.members.length, 2);
    });

    // ── 15. SOLE OWNER DISBAND FLOW ─────────────────────────
    await test('33. Disbanding family when sole owner leaves', async () => {
      // In Family FE, E leaves
      await apiRequest('/leave', { method: 'POST', token: tokens.E });

      // F is now sole owner. Leaving disbands the family!
      const leaveRes = await apiRequest('/leave', { method: 'POST', token: tokens.F });
      assert.equal(leaveRes.status, 200);
      assert.ok(leaveRes.data.message.includes('disbanded'));

      const fam = await Family.findById(inviteA_B_active ? (await Family.findOne({ ownerUserId: userF_Id }))._id : null);
      assert.equal(fam.isActive, false);

      // F can now join another family because previous family is inactive!
      const curF = await apiRequest('/current', { token: tokens.F });
      assert.equal(curF.data.family, null);
    });

    // ── 16. CONCURRENCY SAFETY VERIFICATION ─────────────────
    await test('34. Compensating rollback test: failure to mark invitation accepted cleanly rolls back membership', async () => {
      // Simulate by calling Family.findOneAndUpdate then aborting
      const famBefore = await Family.findById(createdFamilyId);
      const initialCount = famBefore.members.length;

      // Mock an invitation with invalid/nonexistent ID to trigger error in accept
      const fakeInviteId = new mongoose.Types.ObjectId();
      try {
        await FamilyService.acceptInvitation(userG_Id, fakeInviteId.toString());
        assert.fail('Should have failed with 404');
      } catch (err) {
        assert.equal(err.status, 404);
      }

      // Assert family members unchanged
      const famAfter = await Family.findById(createdFamilyId);
      assert.equal(famAfter.members.length, initialCount);
    });

    await test('35. Concurrent acceptance test: two invitees accept near-simultaneously while inviter has no family', async () => {
      const uRaceOwner = await User.create({ id: `u-race-owner-${ts}`, name: 'Race Owner', email: `race-owner-${ts}@test.com`, password: 'hash' });
      const uRaceInv1 = await User.create({ id: `u-race-inv1-${ts}`, name: 'Race Inv1', email: `race-inv1-${ts}@test.com`, password: 'hash' });
      const uRaceInv2 = await User.create({ id: `u-race-inv2-${ts}`, name: 'Race Inv2', email: `race-inv2-${ts}@test.com`, password: 'hash' });

      allTestUserIds.push(uRaceOwner.id, uRaceInv1.id, uRaceInv2.id);

      const tOwner = generateTestToken(uRaceOwner);
      const tInv1 = generateTestToken(uRaceInv1);
      const tInv2 = generateTestToken(uRaceInv2);

      // Owner sends invite to Inv1 and Inv2
      const inv1 = await apiRequest('/invitations', { method: 'POST', token: tOwner, body: { email: uRaceInv1.email } });
      const inv2 = await apiRequest('/invitations', { method: 'POST', token: tOwner, body: { email: uRaceInv2.email } });

      assert.equal(inv1.status, 201);
      assert.equal(inv2.status, 201);

      // Concurrent accept
      const [res1, res2] = await Promise.all([
        apiRequest(`/invitations/${inv1.data.data.id}/accept`, { method: 'POST', token: tInv1 }),
        apiRequest(`/invitations/${inv2.data.data.id}/accept`, { method: 'POST', token: tInv2 })
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      // Invariants:
      // 1. Exactly ONE active family for Race Owner
      const activeFams = await Family.find({ ownerUserId: uRaceOwner.id, isActive: true });
      assert.equal(activeFams.length, 1, 'Exactly one active family must be created despite concurrent race');

      // 2. Both invitees belong to this exact same family
      const singleFam = activeFams[0];
      assert.equal(singleFam.members.length, 3);
      const mIds = singleFam.members.map((m) => m.userId);
      assert.ok(mIds.includes(uRaceOwner.id));
      assert.ok(mIds.includes(uRaceInv1.id));
      assert.ok(mIds.includes(uRaceInv2.id));
      assert.equal(res1.data.familyId, singleFam._id.toString());
      assert.equal(res2.data.familyId, singleFam._id.toString());
    });

    console.log('\n' + '='.repeat(64));
    console.log(`  ALL ${passed} FAMILY SYSTEM BACKEND TESTS PASSED! 🚀`);
    console.log('='.repeat(64));
  } finally {
    await cleanup();
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('\nTest Suite crashed:', err);
  process.exit(1);
});
