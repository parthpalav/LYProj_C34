import React from 'react';

export const NetWorthHistoryNotice: React.FC = () => {
  return (
    <div className="net-worth-history-notice" role="note" aria-label="Net Worth History Availability Notice">
      <div className="notice-icon">ℹ️</div>
      <div className="notice-content">
        <h4 className="notice-title">Real-Time Snapshot Mode</h4>
        <p className="notice-text">
          Historical net-worth trajectory tracking is not yet persisted in the database. FINAURA currently displays your real-time, authoritative balance sheet calculated from your active financial assets and liabilities. Historical net-worth snapshots will be supported in a future update.
        </p>
      </div>
    </div>
  );
};
