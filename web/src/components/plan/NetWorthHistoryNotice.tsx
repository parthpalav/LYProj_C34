import React from 'react';
import { Info } from 'lucide-react';

export const NetWorthHistoryNotice: React.FC = () => {
  return (
    <div className="plan-info-notice" role="note" aria-label="Net Worth History Availability Notice">
      <Info size={18} className="plan-info-notice-icon" aria-hidden="true" />
      <div className="plan-info-notice-content">
        <p className="plan-info-notice-text">
          Historical net-worth tracking is not yet available. This view shows your current authoritative balance sheet.
        </p>
      </div>
    </div>
  );
};
