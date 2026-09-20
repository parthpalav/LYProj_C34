import React, { useState } from 'react';
import { Users, UserPlus, UserMinus, LogOut, Info } from 'lucide-react';
import type { FamilyMember } from '../../types';
import { getMemberInitials } from '../../utils/familyFormatters';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface FamilyMemberListProps {
  members: FamilyMember[];
  currentUserId?: string;
  isOwner: boolean;
  isFamilyFull: boolean;
  actionLoadingId: string | null;
  onOpenInviteModal: () => void;
  onRemoveMember: (userId: string) => Promise<unknown>;
  onLeaveFamily: () => Promise<unknown>;
}

export const FamilyMemberList: React.FC<FamilyMemberListProps> = ({
  members,
  currentUserId,
  isOwner,
  isFamilyFull,
  actionLoadingId,
  onOpenInviteModal,
  onRemoveMember,
  onLeaveFamily,
}) => {
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const memberCount = members.length;
  const isSoleOwner = isOwner && memberCount === 1;

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    try {
      await onRemoveMember(memberToRemove.userId);
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleConfirmLeave = async () => {
    try {
      await onLeaveFamily();
    } finally {
      setShowLeaveDialog(false);
    }
  };

  return (
    <div className="family-members-card" role="region" aria-label="Household Members Roster">
      <div className="family-members-header">
        <div className="family-section-header-row">
          <div className="family-section-icon-wrap blue">
            <Users size={18} />
          </div>
          <div>
            <h3 className="family-section-title">Household Members</h3>
            <p className="family-section-subtitle">
              {memberCount} active member{memberCount === 1 ? '' : 's'} (up to 6)
            </p>
          </div>
        </div>

        {isOwner && !isFamilyFull && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenInviteModal}
            leftIcon={<UserPlus size={15} />}
          >
            Invite Member
          </Button>
        )}

        {isOwner && isFamilyFull && (
          <span className="family-limit-badge">Limit reached (6/6)</span>
        )}
      </div>

      <div className="family-members-list">
        {members.map((m) => {
          const isMe = currentUserId ? m.userId === currentUserId : false;
          const isItemOwner = m.role === 'owner';
          const canRemove = isOwner && !isItemOwner;
          const isRemoving = actionLoadingId === `remove-${m.userId}`;

          return (
            <div key={m.userId} className="family-member-row">
              <div className="family-member-left">
                <div className="family-member-avatar" aria-hidden="true">
                  {getMemberInitials(m.name)}
                </div>
                <div className="family-member-info">
                  <div className="family-member-name-row">
                    <span className="family-member-name">{m.name || 'Family Member'}</span>
                    {isMe && <span className="family-member-me-pill">You</span>}
                  </div>
                  <span className="family-member-role-label">
                    {isItemOwner ? 'Family Owner' : 'Household Member'}
                  </span>
                </div>
              </div>

              <div className="family-member-actions">
                <span className={`family-role-badge ${isItemOwner ? 'owner' : 'member'}`}>
                  {isItemOwner ? 'Owner' : 'Member'}
                </span>

                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMemberToRemove(m)}
                    disabled={isRemoving}
                    isLoading={isRemoving}
                    leftIcon={<UserMinus size={14} />}
                    className="family-remove-btn"
                    aria-label={`Remove ${m.name} from Family`}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Household Lifecycle Actions Footer */}
      <div className="family-members-footer">
        {!isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLeaveDialog(true)}
            leftIcon={<LogOut size={14} />}
            className="family-leave-btn"
            disabled={actionLoadingId === 'leave-family'}
            isLoading={actionLoadingId === 'leave-family'}
          >
            Leave Family
          </Button>
        )}

        {isSoleOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLeaveDialog(true)}
            leftIcon={<LogOut size={14} />}
            className="family-leave-btn"
            disabled={actionLoadingId === 'leave-family'}
            isLoading={actionLoadingId === 'leave-family'}
          >
            Leave Family
          </Button>
        )}

        {isOwner && memberCount > 1 && (
          <div className="family-owner-leave-note">
            <Info size={15} />
            <span>Remove other members before leaving this Family.</span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Remove Member */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Member from Household?"
        message={`Are you sure you want to remove ${memberToRemove?.name} from this Family?`}
        warningNote="Their individual account and financial records will remain completely unchanged."
        confirmLabel="Remove Member"
        cancelLabel="Keep Member"
        variant="danger"
        isLoading={Boolean(memberToRemove && actionLoadingId === `remove-${memberToRemove.userId}`)}
      />

      {/* Confirmation Dialog: Leave Family */}
      <ConfirmDialog
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        onConfirm={handleConfirmLeave}
        title={isSoleOwner ? 'Disband Family?' : 'Leave Family?'}
        message={
          isSoleOwner
            ? 'As the sole member, leaving will close this Family. Your individual financial data will remain unchanged.'
            : 'You will lose access to shared household aggregates and insights. Your personal financial records will remain unchanged.'
        }
        warningNote="Personal transactions, accounts, and FMI will remain unaffected."
        confirmLabel={isSoleOwner ? 'Disband' : 'Leave Family'}
        cancelLabel="Stay in Family"
        variant="danger"
        isLoading={actionLoadingId === 'leave-family'}
      />
    </div>
  );
};
