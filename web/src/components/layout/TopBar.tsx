import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserAvatar } from '../ui/UserAvatar';

export interface TopBarProps {
  onToggleSidebar?: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/app': 'Overview',
  '/app/activity': 'Activity',
  '/app/insights': 'Insights',
  '/app/plan': 'Plan',
  '/app/reports': 'Reports',
  '/app/profile': 'Profile',
  '/app/settings': 'Settings',
};

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const location = useLocation();

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Dashboard';

  // Extract first name (e.g. "Parth Palav" -> "Parth")
  const firstName = user?.name
    ? user.name.trim().split(/\s+/)[0]
    : (user?.email ? user.email.split('@')[0] : 'User');

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile hamburger + Current Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="mobile-hamburger"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.375rem',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={20} />
          </button>
        )}

        <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.25px' }}>
          {currentTitle}
        </div>
      </div>

      {/* Right: Authenticated User Display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
          className="topbar-user-name"
        >
          {firstName}
        </span>
        <UserAvatar user={user} size="sm" />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-hamburger {
            display: flex !important;
          }
          .topbar-user-name {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};
