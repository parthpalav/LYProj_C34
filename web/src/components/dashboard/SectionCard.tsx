import React from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  badge,
  action,
  children,
  className = '',
}) => {
  return (
    <section className={`dashboard-card ${className}`}>
      <div className="dashboard-card-header">
        <div className="dashboard-card-titles">
          <div className="dashboard-card-title-row">
            <h2 className="dashboard-card-title">{title}</h2>
            {badge && <div className="dashboard-card-badge">{badge}</div>}
          </div>
          {subtitle && <p className="dashboard-card-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="dashboard-card-action">{action}</div>}
      </div>
      <div className="dashboard-card-content">{children}</div>
    </section>
  );
};
