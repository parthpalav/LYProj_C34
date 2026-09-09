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
    <header className="topbar-root">
      {/* Left: Mobile hamburger + Current Page Title */}
      <div className="topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="topbar-hamburger"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="topbar-page-title">
          {currentTitle}
        </div>
      </div>

      {/* Right: Authenticated User Display */}
      <div className="topbar-right">
        <span className="topbar-user-name">
          {firstName}
        </span>
        <UserAvatar user={user} size="sm" />
      </div>
    </header>
  );
};
