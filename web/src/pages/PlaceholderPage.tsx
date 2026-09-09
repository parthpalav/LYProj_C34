import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Layers, ArrowUpRight } from 'lucide-react';

export interface PlannedSectionItem {
  name: string;
  description: string;
}

export interface PlaceholderPageProps {
  title: string;
  category?: string;
  description: string;
  plannedFeatures?: PlannedSectionItem[];
  partNotice?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  category,
  description,
  plannedFeatures = [],
  partNotice = 'This module is slated for a future release. Core financial activity, insights, planning, and historical reports are fully active in V1.',
}) => {
  return (
    <div>
      <PageHeader
        title={title}
        category={category || 'COMING SOON'}
        description={description}
      />

      <div style={{ padding: '0 2rem 2rem', maxWidth: '1000px' }}>
        {/* Foundation Notice Card */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            borderLeft: '4px solid var(--accent-primary)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
              Future Release Roadmap
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {partNotice}
            </p>
          </div>
        </div>

        {/* Planned Subsections Grid */}
        {plannedFeatures.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 1rem 0',
              }}
            >
              Planned Capabilities in this Section
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              {plannedFeatures.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.375rem',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}
                      >
                        {item.name}
                      </h3>
                      <ArrowUpRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>

                  <div
                    style={{
                      marginTop: '1rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.6875rem',
                      color: 'var(--text-tertiary)',
                      fontWeight: 500,
                    }}
                  >
                    <span>Status</span>
                    <span
                      style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--accent-subtle)',
                        color: 'var(--accent-primary)',
                        fontWeight: 600,
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
