import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';

export const AppLayout: React.FC = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // One key per top-level page: tabs live in the query string, so switching them never replays the entrance.
  const routeKey = useLocation().pathname.split('/').slice(0, 3).join('/');

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main Viewport */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: '100vh',
        }}
      >
        <TopBar onToggleSidebar={() => setMobileDrawerOpen((prev) => !prev)} />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <div key={routeKey} className="route-view">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
