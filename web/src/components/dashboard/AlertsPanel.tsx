import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { AlertItem } from '../../types';
import { EmptyState } from './EmptyState';
import { formatRelativeDate } from '../../utils/formatters';

interface AlertsPanelProps {
  alerts: AlertItem[];
  limit?: number;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, limit = 4 }) => {
  const displayAlerts = alerts.slice(0, limit);

  if (displayAlerts.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        message="No financial alerts need your attention right now."
        className="alerts-empty-state"
      />
    );
  }

  const getSeverityIcon = (severity: string, type: string) => {
    if (severity === 'high' || type === 'critical') {
      return <AlertTriangle size={16} className="alert-item-icon-crit" />;
    }
    if (severity === 'medium' || type === 'warning') {
      return <AlertTriangle size={16} className="alert-item-icon-warn" />;
    }
    return <Info size={16} className="alert-item-icon-info" />;
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'alert-badge-crit';
      case 'medium':
        return 'alert-badge-warn';
      default:
        return 'alert-badge-info';
    }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-list">
        {displayAlerts.map((alert) => {
          const dateStr = alert.timestamp || alert.createdAt;
          return (
            <div key={alert.id} className="alert-item">
              <div className="alert-item-left">
                <div className="alert-item-icon-wrap" aria-hidden="true">
                  {getSeverityIcon(alert.severity, alert.type)}
                </div>
                <div className="alert-item-content">
                  {alert.title && <h4 className="alert-item-title">{alert.title}</h4>}
                  <p className="alert-item-msg">{alert.message}</p>
                </div>
              </div>
              <div className="alert-item-right">
                <span className={`alert-severity-badge ${getSeverityBadgeClass(alert.severity)}`}>
                  {alert.severity || alert.type}
                </span>
                {dateStr && (
                  <span className="alert-item-date">{formatRelativeDate(dateStr)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length > limit && (
        <div className="alerts-footer-link">
          <Link to="/app/activity" className="alerts-view-all-link">
            View all alerts in Activity →
          </Link>
        </div>
      )}
    </div>
  );
};
