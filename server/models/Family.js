import mongoose from 'mongoose';
import { MAX_FAMILY_MEMBERS } from '../config/familyRules.js';

const familyMemberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const familySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'My Family'
    },
    ownerUserId: {
      type: String,
      required: true
    },
    members: {
      type: [familyMemberSchema],
      required: true,
      validate: {
        validator: function(members) {
          if (!Array.isArray(members) || members.length === 0) return false;
          if (members.length > MAX_FAMILY_MEMBERS) return false;
          const ids = members.map((m) => String(m.userId));
          const uniqueIds = new Set(ids);
          if (uniqueIds.size !== ids.length) return false;
          if (this.ownerUserId && !ids.includes(String(this.ownerUserId))) return false;
          const owners = members.filter((m) => m.role === 'owner');
          if (owners.length !== 1) return false;
          return true;
        },
        message: `Family must contain between 1 and ${MAX_FAMILY_MEMBERS} members, have unique members, and exactly one owner matching ownerUserId`
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true, versionKey: false }
);

// Indexes:
// 1. Partial unique multikey index ensuring one user can belong to at most ONE active Family
familySchema.index(
  { 'members.userId': 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// 2. Owner lookup index
familySchema.index({ ownerUserId: 1 });

// 3. Status index
familySchema.index({ isActive: 1 });

export default mongoose.model('Family', familySchema);
