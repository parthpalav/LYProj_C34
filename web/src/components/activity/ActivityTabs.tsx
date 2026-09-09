import { ReceiptText, ArrowDownLeft, CalendarClock } from 'lucide-react';

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
  const tabs: Array<{ key: ActivityTabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; count?: number }> = [
    { key: 'transactions', label: 'Transactions', icon: ReceiptText, count: counts?.transactions },
    { key: 'income', label: 'Income', icon: ArrowDownLeft, count: counts?.income },
    { key: 'liabilities', label: 'Liabilities', icon: CalendarClock, count: counts?.liabilities },
  ];

  return (
    <div className="activity-tabs-container" role="tablist" aria-label="Activity Categories">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            id={`activity-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`activity-panel-${tab.key}`}
            className={`activity-tab-btn ${isActive ? 'activity-tab-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <Icon size={15} className="tab-icon" aria-hidden="true" />
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
