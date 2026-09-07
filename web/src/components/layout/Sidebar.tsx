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

  const navItemClass = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5625rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
    fontWeight: isActive ? 600 : 500,
    fontSize: '0.875rem',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
    marginBottom: '0.25rem',
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--bg-overlay)',
            zIndex: 40,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}
        className={`sidebar-root ${isOpen ? 'sidebar-open' : ''}`}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--topbar-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <NavLink
            to="/app"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-inverse)',
                fontWeight: 800,
                fontSize: '0.875rem',
              }}
            >
              F
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.25px', lineHeight: 1.1 }}>
                FINAURA
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                Intelligence Web
              </div>
            </div>
          </NavLink>

          {/* Mobile Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="mobile-close-button"
              aria-label="Close navigation"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.375rem',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-tertiary)',
                display: 'none',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 0.875rem',
          }}
        >
          <NavLink to="/app" end style={navItemClass} onClick={onClose}>
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </NavLink>

          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '1.25rem 0 0.5rem 0.5rem',
            }}
          >
            Money
          </div>
          <NavLink to="/app/activity" style={navItemClass} onClick={onClose}>
            <ReceiptText size={18} />
            <span>Activity</span>
          </NavLink>

          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '1.25rem 0 0.5rem 0.5rem',
            }}
          >
            Understand
          </div>
          <NavLink to="/app/insights" style={navItemClass} onClick={onClose}>
            <ChartNoAxesCombined size={18} />
            <span>Insights</span>
          </NavLink>

          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '1.25rem 0 0.5rem 0.5rem',
            }}
          >
            Future
          </div>
          <NavLink to="/app/plan" style={navItemClass} onClick={onClose}>
            <TrendingUp size={18} />
            <span>Plan</span>
          </NavLink>

          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '1.25rem 0 0.5rem 0.5rem',
            }}
          >
            Documents
          </div>
          <NavLink to="/app/reports" style={navItemClass} onClick={onClose}>
            <FileText size={18} />
            <span>Reports</span>
          </NavLink>
        </nav>

        {/* Footer Profile & Logout */}
        <div
          style={{
            padding: '0.875rem',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface-subtle)',
          }}
        >
          <NavLink to="/app/profile" style={navItemClass} onClick={onClose}>
            <UserIcon size={18} />
            <span>Profile</span>
          </NavLink>

          <NavLink to="/app/settings" style={navItemClass} onClick={onClose}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5625rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--danger-text)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)',
              textAlign: 'left',
              marginTop: '0.25rem',
            }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>

          {/* User Quick Info */}
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
            }}
          >
            <UserAvatar user={user} size="sm" />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'User'}
              </div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-root {
            position: fixed !important;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            transition: transform var(--transition-normal);
            box-shadow: var(--shadow-drawer);
          }
          .sidebar-open {
            transform: translateX(0) !important;
          }
          .mobile-close-button {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
};
