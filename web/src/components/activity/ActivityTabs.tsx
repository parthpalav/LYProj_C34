import React from 'react';

export type ActivityTabKey = 'transactions' | 'income' | 'liabilities';

export interface ActivityTabsProps {
  activeTab: ActivityTabKey;
  onTabChange: (tab: ActivityTabKey) => void;
  counts?: {
    transactions?: number;
    income?: number;
    liabilities?: number;
  };
}

export const ActivityTabs: React.FC<ActivityTabsProps> = ({ activeTab, onTabChange, counts }) => {
  const tabs: Array<{ key: ActivityTabKey; label: string; count?: number }> = [
    { key: 'transactions', label: 'Transactions', count: counts?.transactions },
    { key: 'income', label: 'Income', count: counts?.income },
    { key: 'liabilities', label: 'Recurring Liabilities', count: counts?.liabilities },
  ];

  return (
    <div className="activity-tabs-container" role="tablist" aria-label="Activity Categories">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`activity-tab-btn ${isActive ? 'activity-tab-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`activity-tab-badge ${isActive ? 'badge-active' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
