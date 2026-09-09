import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  ChartNoAxesCombined,
  TrendingUp,
  FileText,
  User as UserIcon,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserAvatar } from '../ui/UserAvatar';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="sidebar-backdrop"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`sidebar-root ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <NavLink to="/app" onClick={onClose} className="sidebar-brand-link">
            <div className="sidebar-brand-icon">F</div>
            <div>
              <div className="sidebar-brand-name">FINAURA</div>
              <div className="sidebar-brand-tagline">Intelligence Web</div>
            </div>
          </NavLink>

          {/* Mobile Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <NavLink to="/app" end className={getLinkClass} onClick={onClose}>
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </NavLink>

          <div className="sidebar-section-label">Money</div>
          <NavLink to="/app/activity" className={getLinkClass} onClick={onClose}>
            <ReceiptText size={18} />
            <span>Activity</span>
          </NavLink>

          <div className="sidebar-section-label">Understand</div>
          <NavLink to="/app/insights" className={getLinkClass} onClick={onClose}>
            <ChartNoAxesCombined size={18} />
            <span>Insights</span>
          </NavLink>

          <div className="sidebar-section-label">Future</div>
          <NavLink to="/app/plan" className={getLinkClass} onClick={onClose}>
            <TrendingUp size={18} />
            <span>Plan</span>
          </NavLink>

          <div className="sidebar-section-label">Documents</div>
          <NavLink to="/app/reports" className={getLinkClass} onClick={onClose}>
            <FileText size={18} />
            <span>Reports</span>
          </NavLink>
        </nav>

        {/* Footer Profile & Logout */}
        <div className="sidebar-footer">
          <NavLink to="/app/profile" className={getLinkClass} onClick={onClose}>
            <UserIcon size={18} />
            <span>Profile</span>
          </NavLink>

          <NavLink to="/app/settings" className={getLinkClass} onClick={onClose}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>

          <button onClick={handleLogout} className="sidebar-logout-btn">
            <LogOut size={18} />
            <span>Logout</span>
          </button>

          {/* User Quick Info */}
          <div className="sidebar-user-card">
            <UserAvatar user={user} size="sm" />
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user?.name || 'User'}
              </div>
              <div className="sidebar-user-email">
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
