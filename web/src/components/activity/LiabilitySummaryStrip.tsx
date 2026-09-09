import React from 'react';
import { formatCurrencyINR, formatDateFull, formatRelativeDate } from '../../utils/formatters';

export interface LiabilitySummaryStripProps {
  activeCount: number;
  dueNext30Days: number;
  nearestDueDate: string | null;
}

export const LiabilitySummaryStrip: React.FC<LiabilitySummaryStripProps> = ({
  activeCount,
  dueNext30Days,
  nearestDueDate,
}) => {
  const nearestDateFormatted = nearestDueDate
    ? `${formatRelativeDate(nearestDueDate)} (${formatDateFull(nearestDueDate)})`
    : 'None scheduled';

  return (
    <div className="activity-summary-strip" role="region" aria-label="Liabilities Summary">
      <div className="summary-item">
        <span className="summary-label">Active Obligations</span>
        <span className="summary-value tabular-nums">{activeCount}</span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Due Next 30 Days</span>
        <span className="summary-value summary-warning tabular-nums">
          {formatCurrencyINR(dueNext30Days)}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Nearest Due Date</span>
        <span className="summary-value text-normal">
          {nearestDateFormatted}
        </span>
      </div>
    </div>
  );
};
