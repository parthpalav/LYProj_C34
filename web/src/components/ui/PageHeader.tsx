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
    <header className="page-header-root">
      <div className="page-header-content">
        <div>
          {category && (
            <span className="page-header-category">
              {category}
            </span>
          )}
          <h1 className="page-header-title">
            {title}
          </h1>
          {description && (
            <p className="page-header-desc">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>

      {tabs && (
        <div className="page-header-tabs">
          {tabs}
        </div>
      )}
    </header>
  );
};
