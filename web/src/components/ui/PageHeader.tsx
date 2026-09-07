import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  category?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  category,
  actions,
  tabs,
}) => {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          {category && (
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--accent-text)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '0.375rem',
              }}
            >
              {category}
            </span>
          )}
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.375rem 0',
              letterSpacing: '-0.25px',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                margin: 0,
                maxWidth: '650px',
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {actions}
          </div>
        )}
      </div>

      {tabs && (
        <div style={{ marginTop: '1.25rem', paddingTop: '0.5rem' }}>
          {tabs}
        </div>
      )}
    </header>
  );
};
