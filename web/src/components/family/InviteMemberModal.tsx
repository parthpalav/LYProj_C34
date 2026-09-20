import React, { useState } from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInvite: (email: string) => Promise<unknown>;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onSendInvite,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setEmail('');
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    // Client-side UX validation only
    if (!trimmed) {
      setError('Please enter an email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSendInvite(trimmed);
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite a Family Member"
      subtitle="Invite an existing FINAURA user to build a shared household view."
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit} className="invite-modal-form">
        {error && (
          <div className="invite-error-banner" role="alert">
            <AlertCircle size={16} className="invite-error-icon" />
            <span className="invite-error-text">{error}</span>
          </div>
        )}

        <div className="invite-input-wrap">
          <Input
            label="Email address"
            type="email"
            placeholder="rhea@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            leftIcon={<Mail size={16} />}
            helperText="They'll need an existing FINAURA account using this email."
            autoFocus
            required
            disabled={isLoading}
          />
        </div>

        <div className="invite-modal-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading || !email.trim()}
          >
            Send Invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
