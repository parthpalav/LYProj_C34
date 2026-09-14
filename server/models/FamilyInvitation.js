import mongoose from 'mongoose';

const familyInvitationSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      default: null
    },
    inviterUserId: {
      type: String,
      required: true
    },
    inviteeUserId: {
      type: String,
      required: true
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    pairKey: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'],
      default: 'pending'
    },
    expiresAt: {
      type: Date,
      required: true
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true, versionKey: false }
);

// Self-invitation check validator
familyInvitationSchema.pre('validate', function (next) {
  if (this.inviterUserId && this.inviteeUserId && String(this.inviterUserId) === String(this.inviteeUserId)) {
    this.invalidate('inviteeUserId', 'You cannot invite yourself to a family');
  }
  next();
});

// Indexes:
// 1. Enforce at most one active pending invitation per user pair regardless of direction
familyInvitationSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// 2. Fast received invitations query
familyInvitationSchema.index({ inviteeUserId: 1, status: 1 });

// 3. Fast sent invitations query
familyInvitationSchema.index({ inviterUserId: 1, status: 1 });

// 4. Family linkage query
familyInvitationSchema.index({ familyId: 1, status: 1 });

// 5. Expiration scan query
familyInvitationSchema.index({ expiresAt: 1 });

export default mongoose.model('FamilyInvitation', familyInvitationSchema);
