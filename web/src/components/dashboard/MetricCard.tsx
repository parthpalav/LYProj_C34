import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    text: string;
    positive?: boolean;
    neutral?: boolean;
  };
  icon?: LucideIcon;
  badge?: string;
  variant?: 'default' | 'hero';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  badge,
  variant = 'default',
  className = '',
}) => {
  const isHero = variant === 'hero';

  return (
    <div
      className={[
        'metric-card',
        isHero ? 'metric-card-hero sheen-effect' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{label}</span>
        <div className="metric-card-header-right">
          {badge && <span className="metric-card-badge">{badge}</span>}
          {Icon && (
            <div className={`metric-card-icon-wrap ${isHero ? 'hero-icon-wrap' : ''}`} aria-hidden="true">
              <Icon size={isHero ? 20 : 18} />
            </div>
          )}
        </div>
      </div>

      <div className="metric-card-body">
        <div className={`metric-card-value tabular-nums ${isHero ? 'hero-value' : ''}`}>
          {value}
        </div>

        {(trend || subtext) && (
          <div className="metric-card-footer">
            {trend && (
              <span
                className={`metric-trend ${
                  trend.neutral
                    ? 'metric-trend-neutral'
                    : trend.positive
                    ? 'metric-trend-pos'
                    : 'metric-trend-neg'
                }`}
              >
                {trend.text}
              </span>
            )}
            {subtext && <span className="metric-subtext">{subtext}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
