import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, Clock } from 'lucide-react';
import type { Liability } from '../../types';
import { formatCurrencyINR, formatDateShort } from '../../utils/formatters';
import { getSortedUpcomingLiabilities } from '../../services/dashboard';
import { EmptyState } from './EmptyState';

interface UpcomingLiabilitiesProps {
  liabilities: Liability[];
  limit?: number;
}

export const UpcomingLiabilities: React.FC<UpcomingLiabilitiesProps> = ({
  liabilities,
  limit = 4,
}) => {
  const sorted = getSortedUpcomingLiabilities(liabilities, limit);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        message="No upcoming liabilities scheduled."
        action={
          <Link to="/app/activity" className="empty-state-link">
            Set up recurring liabilities →
          </Link>
        }
      />
    );
  }

  return (
    <div className="liabilities-panel">
      <div className="liabilities-list">
        {sorted.map((liability) => (
          <div key={liability.id} className="liability-item">
            <div className="liability-item-left">
              <div className="liability-icon-wrap" aria-hidden="true">
                <Clock size={16} />
              </div>
              <div className="liability-info">
                <h4 className="liability-name">{liability.name}</h4>
                <div className="liability-meta">
                  <span className="liability-category">{liability.category}</span>
                  <span className="liability-dot">·</span>
                  <span className="liability-freq">{liability.frequency}</span>
                </div>
              </div>
            </div>

            <div className="liability-item-right">
              <div className="liability-amount">
                {formatCurrencyINR(liability.amount)}
              </div>
              <div className="liability-due-row">
                <span className="liability-due-date">
                  Due {formatDateShort(liability.nextDueDate)}
                </span>
                {liability.autoDeduct ? (
                  <span className="liability-auto-badge">
                    <Check size={11} aria-hidden="true" /> Auto
                  </span>
                ) : (
                  <span className="liability-manual-badge">Manual</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="liabilities-footer-link">
        <Link to="/app/activity" className="liabilities-view-all-link">
          Manage all obligations in Activity →
        </Link>
      </div>
    </div>
  );
};
