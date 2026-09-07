import React from 'react';
import type { User } from '../../types';
import { getUserInitials } from '../../utils/formatters';

export interface UserAvatarProps {
  user?: User | null;
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md' }) => {
  const initials = getUserInitials(user);

  const getDimension = () => {
    switch (size) {
      case 'sm':
        return { width: '28px', height: '28px', fontSize: '0.75rem' };
      case 'lg':
        return { width: '44px', height: '44px', fontSize: '1rem' };
      case 'md':
      default:
        return { width: '36px', height: '36px', fontSize: '0.875rem' };
    }
  };

  const dim = getDimension();

  return (
    <div
      title={user?.name || user?.email || 'User Avatar'}
      style={{
        width: dim.width,
        height: dim.height,
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--accent-subtle)',
        color: 'var(--accent-text)',
        border: '1px solid var(--border-default)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: dim.fontSize,
        letterSpacing: '0.5px',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};
