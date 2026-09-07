import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-subtle)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <Compass size={28} />
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
        Page Not Found
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
        The page you are looking for does not exist or has moved. Please check the URL or return to the platform.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Link to="/app">
          <Button variant="primary" size="md">
            Go to Overview
          </Button>
        </Link>
        <Link to="/">
          <Button variant="outline" size="md">
            Public Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
