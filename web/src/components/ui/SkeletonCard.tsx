import React from 'react';

interface SkeletonCardProps {
  height?: string | number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = '140px',
  className = '',
}) => {
  return (
    <div
      className={`skeleton-card ${className}`}
      style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
      aria-hidden="true"
    >
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-metric" />
      <div className="skeleton-line skeleton-subtext" />
    </div>
  );
};
