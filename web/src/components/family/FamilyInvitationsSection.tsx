import React, { useState } from 'react';
import { Mail, Send, Check, X, Clock, Trash2 } from 'lucide-react';
import type { FamilyInvitation } from '../../types';
import { formatExpiry } from '../../utils/familyFormatters';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface FamilyInvitationsSectionProps {
  receivedInvitations: FamilyInvitation[];
  sentInvitations: FamilyInvitation[];
  actionLoadingId: string | null;
  onAccept: (id: string) => Promise<unknown>;
  onDecline: (id: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
}

export const FamilyInvitationsSection: React.FC<FamilyInvitationsSectionProps> = ({
  receivedInvitations,
  sentInvitations,
  actionLoadingId,
  onAccept,
  onDecline,
  onCancel,
}) => {
  const [inviteToCancel, setInviteToCancel] = useState<FamilyInvitation | null>(null);

  const pendingSent = sentInvitations.filter((inv) => inv.status === 'pending');

  if (receivedInvitations.length === 0 && pendingSent.length === 0) {
    return null;
  }

  const handleConfirmCancel = async () => {
    if (!inviteToCancel) return;
    try {
      await onCancel(inviteToCancel.id);
    } finally {
      setInviteToCancel(null);
    }
  };

  return (
    <div className="family-invitations-wrapper">
      {/* ── Received Invitations for You ──────────────────────── */}
      {receivedInvitations.length > 0 && (
        <div className="family-invites-card">
          <div className="family-invites-header">
            <div className="family-invites-header-icon received">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="family-invites-title">Invitations for You</h3>
              <p className="family-invites-subtitle">
                Join an existing household to unlock shared financial aggregates.
              </p>
            </div>
          </div>

          <div className="family-invites-list">
            {receivedInvitations.map((inv) => {
              const isAccepting = actionLoadingId === `accept-${inv.id}`;
              const isDeclining = actionLoadingId === `decline-${inv.id}`;
              const inFlight = isAccepting || isDeclining;

              return (
                <div key={inv.id} className="family-invite-item">
                  <div className="family-invite-info">
                    <div className="family-invite-avatar">
                      {(inv.inviterName || 'F').charAt(0).toUpperCase()}
                    </div>
                    <div className="family-invite-details">
                      <div className="family-invite-text">
                        <strong>{inv.inviterName || 'A FINAURA user'}</strong> invited you to join their Family.
                      </div>
                      {inv.expiresAt && (
                        <div className="family-invite-expiry">
                          <Clock size={12} />
                          <span>Expires {formatExpiry(inv.expiresAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="family-invite-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDecline(inv.id)}
                      disabled={inFlight}
                      isLoading={isDeclining}
                      leftIcon={<X size={14} />}
                      aria-label={`Decline invitation from ${inv.inviterName || 'user'}`}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onAccept(inv.id)}
                      disabled={inFlight}
                      isLoading={isAccepting}
                      leftIcon={<Check size={14} />}
                      aria-label={`Accept invitation from ${inv.inviterName || 'user'}`}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Sent Invitations ─────────────────────────── */}
      {pendingSent.length > 0 && (
        <div className="family-invites-card">
          <div className="family-invites-header">
            <div className="family-invites-header-icon sent">
              <Send size={18} />
            </div>
            <div>
              <h3 className="family-invites-title">Pending Invitations</h3>
              <p className="family-invites-subtitle">
                Invitations sent from your account waiting for a response.
              </p>
            </div>
          </div>

          <div className="family-invites-list">
            {pendingSent.map((inv) => {
              const isCancelling = actionLoadingId === `cancel-${inv.id}`;

              return (
                <div key={inv.id} className="family-invite-item">
                  <div className="family-invite-info">
                    <div className="family-invite-avatar pending">
                      {(inv.inviteeEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="family-invite-details">
                      <div className="family-invite-email">{inv.inviteeEmail}</div>
                      <div className="family-invite-expiry">
                        <span>Waiting for response</span>
                        {inv.expiresAt && (
                          <>
                            <span>·</span>
                            <Clock size={12} />
                            <span>Expires {formatExpiry(inv.expiresAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="family-invite-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteToCancel(inv)}
                      disabled={isCancelling}
                      isLoading={isCancelling}
                      leftIcon={<Trash2 size={14} />}
                      aria-label={`Cancel invitation for ${inv.inviteeEmail}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Cancelling Sent Invitation */}
      <ConfirmDialog
        isOpen={Boolean(inviteToCancel)}
        onClose={() => setInviteToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Invitation?"
        message={`Are you sure you want to cancel the pending invitation to ${inviteToCancel?.inviteeEmail}?`}
        warningNote="They will no longer be able to use this invitation to join your Family."
        confirmLabel="Cancel Invitation"
        cancelLabel="Keep Invitation"
        variant="danger"
        isLoading={Boolean(inviteToCancel && actionLoadingId === `cancel-${inviteToCancel.id}`)}
      />
    </div>
  );
};
