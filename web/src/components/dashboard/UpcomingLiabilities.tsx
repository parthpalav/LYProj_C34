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

  const getDueLabel = (dateStr?: string | null) => {
    if (!dateStr) return 'Scheduled';
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return 'Scheduled';
    const now = new Date();
    // Normalize to dates
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue · ${formatDateShort(dateStr)}`;
    if (diffDays === 0) return `Due today · ${formatDateShort(dateStr)}`;
    if (diffDays === 1) return `Due tomorrow · ${formatDateShort(dateStr)}`;
    if (diffDays <= 7) return `Due in ${diffDays}d · ${formatDateShort(dateStr)}`;
    return formatDateShort(dateStr);
  };

  return (
    <div className="upcoming-liabilities-list">
      <div className="liabilities-items">
        {sorted.map((liability) => (
          <div key={liability.id} className="liability-item-row">
            <div className="liability-item-left">
              <div className="liability-icon-wrap" aria-hidden="true">
                <Clock size={16} className="text-secondary" />
              </div>
              <div className="liability-details">
                <span className="liability-title">{liability.name}</span>
                <div className="liability-sub">
                  <span className="liability-category">{liability.category}</span>
                  <span className="liability-dot">·</span>
                  <span className="liability-freq">{liability.frequency}</span>
                </div>
              </div>
            </div>

            <div className="liability-item-right">
              <div className="liability-amount tabular-nums">
                {formatCurrencyINR(liability.amount)}
              </div>
              <div className="liability-due-row">
                <span
                  className="liability-due-date"
                  title={liability.nextDueDate ? new Date(liability.nextDueDate).toLocaleDateString() : 'Scheduled'}
                >
                  {getDueLabel(liability.nextDueDate)}
                </span>
                {liability.autoDeduct ? (
                  <span className="liability-auto-badge" title="Auto-deduction active">
                    <Check size={11} aria-hidden="true" /> Auto
                  </span>
                ) : (
                  <span className="liability-manual-badge" title="Manual payment required">
                    Manual
                  </span>
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
