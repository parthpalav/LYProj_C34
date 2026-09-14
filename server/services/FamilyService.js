import mongoose from 'mongoose';
import Family from '../models/Family.js';
import FamilyInvitation from '../models/FamilyInvitation.js';
import User from '../models/User.js';
import {
  MAX_FAMILY_MEMBERS,
  FAMILY_INVITE_EXPIRY_DAYS,
  makePairKey
} from '../config/familyRules.js';

/**
 * Normalizes an email address.
 *
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Helper to build a safe filter for User by string ID or ObjectId
 *
 * @param {string} userId
 * @returns {Object}
 */
function userFilter(userId) {
  const conditions = [{ id: String(userId) }];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    conditions.push({ _id: userId });
  }
  return { $or: conditions };
}

/**
 * Transitions past-due pending invitations matching filter to 'expired'.
 *
 * @param {Object} query
 */
async function expireStaleInvitations(query = {}) {
  const now = new Date();
  await FamilyInvitation.updateMany(
    { ...query, status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired', respondedAt: now } }
  );
}

/**
 * Custom error helper with HTTP status code.
 *
 * @param {string} message
 * @param {number} status
 * @returns {Error}
 */
function createHttpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Retrieves the current active family for a user, including member names.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getActiveFamilyForUser(userId) {
  if (!userId) return null;
  const uid = String(userId);

  const family = await Family.findOne({
    'members.userId': uid,
    isActive: true
  }).lean();

  if (!family) return null;

  // Resolve member display names safely
  const memberUserIds = family.members.map((m) => m.userId);
  const objectIdCandidates = memberUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const userDocs = await User.find({
    $or: [
      { id: { $in: memberUserIds } },
      ...(objectIdCandidates.length ? [{ _id: { $in: objectIdCandidates } }] : [])
    ]
  }).select('id _id name email').lean();

  const nameMap = new Map();
  for (const u of userDocs) {
    if (u.id) nameMap.set(String(u.id), u.name);
    if (u._id) nameMap.set(String(u._id), u.name);
  }

  const currentUserRole = family.members.find((m) => m.userId === uid)?.role || 'member';

  return {
    id: family._id.toString(),
    _id: family._id,
    name: family.name,
    ownerUserId: family.ownerUserId,
    role: currentUserRole,
    members: family.members.map((m) => ({
      userId: m.userId,
      name: nameMap.get(m.userId) || 'Family Member',
      role: m.role,
      joinedAt: m.joinedAt
    })),
    createdAt: family.createdAt,
    updatedAt: family.updatedAt
  };
}

/**
 * Retrieves pending received invitations for a user.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getReceivedInvitations(userId) {
  if (!userId) return [];
  const uid = String(userId);

  // Expire past-due invitations first
  await expireStaleInvitations({ inviteeUserId: uid });

  const invitations = await FamilyInvitation.find({
    inviteeUserId: uid,
    status: 'pending'
  }).sort({ createdAt: -1 }).lean();

  if (!invitations.length) return [];

  // Look up inviter display names
  const inviterIds = [...new Set(invitations.map((i) => i.inviterUserId))];
  const objectIdCandidates = inviterIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const inviterDocs = await User.find({
    $or: [
      { id: { $in: inviterIds } },
      ...(objectIdCandidates.length ? [{ _id: { $in: objectIdCandidates } }] : [])
    ]
  }).select('id _id name').lean();

  const inviterNameMap = new Map();
  for (const u of inviterDocs) {
    if (u.id) inviterNameMap.set(String(u.id), u.name);
    if (u._id) inviterNameMap.set(String(u._id), u.name);
  }

  return invitations.map((inv) => ({
    id: inv._id.toString(),
    _id: inv._id,
    familyId: inv.familyId ? inv.familyId.toString() : null,
    inviterUserId: inv.inviterUserId,
    inviterName: inviterNameMap.get(inv.inviterUserId) || 'FINAURA User',
    status: inv.status,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt
  }));
}

/**
 * Retrieves sent invitations created by a user.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getSentInvitations(userId) {
  if (!userId) return [];
  const uid = String(userId);

  await expireStaleInvitations({ inviterUserId: uid });

  const invitations = await FamilyInvitation.find({
    inviterUserId: uid
  }).sort({ createdAt: -1 }).lean();

  return invitations.map((inv) => ({
    id: inv._id.toString(),
    _id: inv._id,
    familyId: inv.familyId ? inv.familyId.toString() : null,
    inviteeUserId: inv.inviteeUserId,
    inviteeEmail: inv.inviteeEmail,
    status: inv.status,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    respondedAt: inv.respondedAt
  }));
}

/**
 * Sends an invitation to a registered FINAURA user via exact email.
 *
 * @param {string} inviterUserId
 * @param {string} rawEmail
 * @returns {Promise<Object>}
 */
export async function sendInvitation(inviterUserId, rawEmail) {
  if (!inviterUserId) {
    throw createHttpError('Authentication required', 401);
  }

  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes('@')) {
    throw createHttpError('A valid email address is required', 400);
  }

  // 1. Exact server-side lookup of invitee
  const invitee = await User.findOne({ email }).lean();
  if (!invitee) {
    throw createHttpError('No registered FINAURA user found with this email address', 404);
  }

  const inviteeId = invitee.id || invitee._id?.toString();
  const inviterId = String(inviterUserId);

  // 2. Reject self-invitations
  if (inviteeId === inviterId || (invitee._id && invitee._id.toString() === inviterId)) {
    throw createHttpError('You cannot invite yourself to a family', 400);
  }

  // 3. Inspect inviter active family status
  const inviterFamily = await Family.findOne({
    'members.userId': inviterId,
    isActive: true
  });

  let targetFamilyId = null;

  if (inviterFamily) {
    // V1 rule: Only the owner can invite new members once a family exists
    if (inviterFamily.ownerUserId !== inviterId) {
      throw createHttpError('Only the family owner can invite new members', 403);
    }
    // Check family size limit
    if (inviterFamily.members.length >= MAX_FAMILY_MEMBERS) {
      throw createHttpError(`Family has reached maximum capacity of ${MAX_FAMILY_MEMBERS} members`, 400);
    }
    targetFamilyId = inviterFamily._id;
  }

  // 4. Inspect invitee active family status
  const inviteeFamily = await Family.findOne({
    'members.userId': inviteeId,
    isActive: true
  });

  if (inviteeFamily) {
    throw createHttpError('This user is already a member of a family', 409);
  }

  // 5. Canonical pairKey validation
  const pairKey = makePairKey(inviterId, inviteeId);

  // Check for existing pending invitation for this pairKey
  const existingPending = await FamilyInvitation.findOne({
    pairKey,
    status: 'pending'
  });

  if (existingPending) {
    // Check if expired
    if (existingPending.expiresAt < new Date()) {
      existingPending.status = 'expired';
      existingPending.respondedAt = new Date();
      await existingPending.save();
    } else {
      if (existingPending.inviterUserId === inviterId) {
        throw createHttpError('A pending invitation has already been sent to this user', 409);
      } else {
        throw createHttpError(
          'This user has already sent you a pending invitation. Please check your received invitations to accept or decline.',
          409
        );
      }
    }
  }

  // 6. Create pending FamilyInvitation
  const expiresAt = new Date(Date.now() + FAMILY_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  let invitation;
  try {
    invitation = await FamilyInvitation.create({
      familyId: targetFamilyId,
      inviterUserId: inviterId,
      inviteeUserId: inviteeId,
      inviteeEmail: email,
      pairKey,
      status: 'pending',
      expiresAt
    });
  } catch (err) {
    if (err.code === 11000) {
      throw createHttpError('A pending invitation already exists for this user pair', 409);
    }
    throw err;
  }

  return {
    id: invitation._id.toString(),
    _id: invitation._id,
    familyId: targetFamilyId ? targetFamilyId.toString() : null,
    inviterUserId: inviterId,
    inviteeUserId: inviteeId,
    inviteeEmail: email,
    status: 'pending',
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt
  };
}

/**
 * Accepts a pending family invitation with failure-safe rollback protections.
 *
 * @param {string} inviteeUserId
 * @param {string} invitationId
 * @returns {Promise<Object>}
 */
export async function acceptInvitation(inviteeUserId, invitationId) {
  if (!inviteeUserId) {
    throw createHttpError('Authentication required', 401);
  }
  if (!invitationId) {
    throw createHttpError('Invitation ID is required', 400);
  }

  const uid = String(inviteeUserId);

  const invitation = await FamilyInvitation.findById(invitationId);
  if (!invitation) {
    throw createHttpError('Invitation not found', 404);
  }

  if (invitation.inviteeUserId !== uid) {
    throw createHttpError('You are not authorized to accept this invitation', 403);
  }

  if (invitation.status !== 'pending') {
    throw createHttpError(`Invitation is already ${invitation.status}`, 400);
  }

  if (invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    invitation.respondedAt = new Date();
    await invitation.save();
    throw createHttpError('Invitation has expired', 400);
  }

  // Double check invitee doesn't already have an active family
  const inviteeCurrentFamily = await Family.findOne({
    'members.userId': uid,
    isActive: true
  });
  if (inviteeCurrentFamily) {
    throw createHttpError('You already belong to an active family. Please leave your current family before joining another.', 409);
  }

  let finalFamily;

  // ── CASE A: Existing family referenced on invite ────────────────────────
  if (invitation.familyId) {
    const targetFamily = await Family.findOne({
      _id: invitation.familyId,
      isActive: true
    });

    if (!targetFamily) {
      invitation.status = 'cancelled';
      invitation.respondedAt = new Date();
      await invitation.save();
      throw createHttpError('The target family is no longer active', 409);
    }

    if (targetFamily.ownerUserId !== invitation.inviterUserId) {
      invitation.status = 'cancelled';
      invitation.respondedAt = new Date();
      await invitation.save();
      throw createHttpError('The inviter is no longer the owner of this family', 409);
    }

    if (targetFamily.members.length >= MAX_FAMILY_MEMBERS) {
      throw createHttpError(`Family has reached maximum capacity of ${MAX_FAMILY_MEMBERS} members`, 400);
    }

    // Atomically add invitee to members
    const updatedFamily = await Family.findOneAndUpdate(
      {
        _id: targetFamily._id,
        isActive: true,
        'members.userId': { $ne: uid },
        $expr: { $lt: [{ $size: '$members' }, MAX_FAMILY_MEMBERS] }
      },
      {
        $push: {
          members: {
            userId: uid,
            role: 'member',
            joinedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!updatedFamily) {
      throw createHttpError('Unable to join family. It may be full or you are already a member.', 409);
    }

    // Atomically transition invitation to accepted
    const updatedInvite = await FamilyInvitation.findOneAndUpdate(
      { _id: invitation._id, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { new: true }
    );

    if (!updatedInvite) {
      // Compensating rollback: remove the just-added member
      await Family.updateOne(
        { _id: targetFamily._id },
        { $pull: { members: { userId: uid } } }
      );
      throw createHttpError('Failed to finalize invitation acceptance', 500);
    }

    finalFamily = updatedFamily;
  } else {
    // ── CASE B: First acceptance — Family creation ─────────────────────────
    // Re-check inviter current active family
    const inviterCurrentFamily = await Family.findOne({
      'members.userId': invitation.inviterUserId,
      isActive: true
    });

    if (inviterCurrentFamily) {
      if (inviterCurrentFamily.ownerUserId === invitation.inviterUserId) {
        // Inviter created a family in the interim via another acceptance.
        // Join that family instead (recursive safely via Case A logic).
        invitation.familyId = inviterCurrentFamily._id;
        await invitation.save();
        return acceptInvitation(inviteeUserId, invitationId);
      } else {
        invitation.status = 'cancelled';
        invitation.respondedAt = new Date();
        await invitation.save();
        throw createHttpError('The inviter has joined another family as a non-owner member', 409);
      }
    }

    // Inviter has no active family; create the new Family
    let newFamily;
    try {
      newFamily = await Family.create({
        name: 'My Family',
        ownerUserId: invitation.inviterUserId,
        members: [
          { userId: invitation.inviterUserId, role: 'owner', joinedAt: new Date() },
          { userId: uid, role: 'member', joinedAt: new Date() }
        ],
        isActive: true
      });
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent acceptance just created the family! Re-lookup inviter's family and join it.
        const concurrentFamily = await Family.findOne({
          ownerUserId: invitation.inviterUserId,
          isActive: true
        });
        if (concurrentFamily) {
          invitation.familyId = concurrentFamily._id;
          await invitation.save();
          return acceptInvitation(inviteeUserId, invitationId);
        }
        throw createHttpError('A member already belongs to an active family (concurrent creation conflict)', 409);
      }
      throw err;
    }

    // Atomically link and accept invitation
    const updatedInvite = await FamilyInvitation.findOneAndUpdate(
      { _id: invitation._id, status: 'pending' },
      {
        $set: {
          status: 'accepted',
          familyId: newFamily._id,
          respondedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedInvite) {
      // Compensating rollback: delete the newly created family
      await Family.deleteOne({ _id: newFamily._id });
      throw createHttpError('Failed to finalize invitation acceptance', 500);
    }

    // Critical invariant (Decision 20 & 26):
    // Inviter A had sent pending invites to B and C.
    // When B accepts, Family A+B is created.
    // Any remaining pending invitations sent by A (with familyId === null) are updated
    // to reference this new Family so subsequent accepts join the same family!
    await FamilyInvitation.updateMany(
      {
        inviterUserId: invitation.inviterUserId,
        status: 'pending',
        familyId: null
      },
      { $set: { familyId: newFamily._id } }
    );

    finalFamily = newFamily;
  }

  // Cleanup: Cancel all other pending invitations where invitee is inviteeUserId
  await FamilyInvitation.updateMany(
    {
      inviteeUserId: uid,
      status: 'pending',
      _id: { $ne: invitation._id }
    },
    { $set: { status: 'cancelled', respondedAt: new Date() } }
  );

  // Also cancel outgoing pending invitations created by invitee when they had no family
  await FamilyInvitation.updateMany(
    {
      inviterUserId: uid,
      status: 'pending'
    },
    { $set: { status: 'cancelled', respondedAt: new Date() } }
  );

  return {
    success: true,
    message: 'Invitation accepted. You are now a member of the family.',
    familyId: finalFamily._id.toString()
  };
}

/**
 * Declines a pending invitation.
 *
 * @param {string} inviteeUserId
 * @param {string} invitationId
 * @returns {Promise<Object>}
 */
export async function declineInvitation(inviteeUserId, invitationId) {
  if (!inviteeUserId) {
    throw createHttpError('Authentication required', 401);
  }
  if (!invitationId) {
    throw createHttpError('Invitation ID is required', 400);
  }

  const uid = String(inviteeUserId);

  const invitation = await FamilyInvitation.findById(invitationId);
  if (!invitation) {
    throw createHttpError('Invitation not found', 404);
  }

  if (invitation.inviteeUserId !== uid) {
    throw createHttpError('You are not authorized to decline this invitation', 403);
  }

  if (invitation.status !== 'pending') {
    throw createHttpError(`Invitation is not pending (already ${invitation.status})`, 400);
  }

  const updated = await FamilyInvitation.findOneAndUpdate(
    { _id: invitation._id, status: 'pending' },
    { $set: { status: 'declined', respondedAt: new Date() } },
    { new: true }
  );

  return {
    success: true,
    message: 'Invitation declined.',
    id: updated._id.toString(),
    status: 'declined'
  };
}

/**
 * Cancels a pending invitation (inviter only).
 *
 * @param {string} inviterUserId
 * @param {string} invitationId
 * @returns {Promise<Object>}
 */
export async function cancelInvitation(inviterUserId, invitationId) {
  if (!inviterUserId) {
    throw createHttpError('Authentication required', 401);
  }
  if (!invitationId) {
    throw createHttpError('Invitation ID is required', 400);
  }

  const uid = String(inviterUserId);

  const invitation = await FamilyInvitation.findById(invitationId);
  if (!invitation) {
    throw createHttpError('Invitation not found', 404);
  }

  if (invitation.inviterUserId !== uid) {
    throw createHttpError('You are not authorized to cancel this invitation', 403);
  }

  if (invitation.status !== 'pending') {
    throw createHttpError(`Invitation is not pending (already ${invitation.status})`, 400);
  }

  const updated = await FamilyInvitation.findOneAndUpdate(
    { _id: invitation._id, status: 'pending' },
    { $set: { status: 'cancelled', respondedAt: new Date() } },
    { new: true }
  );

  return {
    success: true,
    message: 'Invitation cancelled.',
    id: updated._id.toString(),
    status: 'cancelled'
  };
}

/**
 * Leaves a family. Non-owners may leave at any time.
 * Owner can only leave if they are the sole member (which disbands the family).
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function leaveFamily(userId) {
  if (!userId) {
    throw createHttpError('Authentication required', 401);
  }

  const uid = String(userId);

  const family = await Family.findOne({
    'members.userId': uid,
    isActive: true
  });

  if (!family) {
    throw createHttpError('You do not belong to an active family', 400);
  }

  if (family.ownerUserId === uid) {
    if (family.members.length > 1) {
      throw createHttpError('Owner cannot leave while other family members remain. Please remove members or disband the family.', 409);
    }
    // Sole member owner: disband family
    family.isActive = false;
    await family.save();

    // Cancel any remaining pending invitations for this family
    await FamilyInvitation.updateMany(
      { familyId: family._id, status: 'pending' },
      { $set: { status: 'cancelled', respondedAt: new Date() } }
    );

    return {
      success: true,
      message: 'Family disbanded successfully.'
    };
  }

  // Non-owner member: atomically pull self
  await Family.findOneAndUpdate(
    { _id: family._id, isActive: true },
    { $pull: { members: { userId: uid } } },
    { new: true }
  );

  return {
    success: true,
    message: 'Left family successfully.'
  };
}

/**
 * Removes a member from the family (owner only).
 *
 * @param {string} ownerUserId
 * @param {string} memberUserIdToRemove
 * @returns {Promise<Object>}
 */
export async function removeFamilyMember(ownerUserId, memberUserIdToRemove) {
  if (!ownerUserId) {
    throw createHttpError('Authentication required', 401);
  }
  if (!memberUserIdToRemove) {
    throw createHttpError('Target member user ID is required', 400);
  }

  const ownerId = String(ownerUserId);
  const targetId = String(memberUserIdToRemove);

  if (ownerId === targetId) {
    throw createHttpError('Owner cannot be removed. Use leave family to disband if sole member.', 400);
  }

  const family = await Family.findOne({
    ownerUserId: ownerId,
    isActive: true
  });

  if (!family) {
    throw createHttpError('Only the family owner can remove members', 403);
  }

  const isMember = family.members.some((m) => m.userId === targetId);
  if (!isMember) {
    throw createHttpError('User is not a member of your family', 404);
  }

  await Family.findOneAndUpdate(
    { _id: family._id, isActive: true },
    { $pull: { members: { userId: targetId } } },
    { new: true }
  );

  return {
    success: true,
    message: 'Member removed from family successfully.'
  };
}
