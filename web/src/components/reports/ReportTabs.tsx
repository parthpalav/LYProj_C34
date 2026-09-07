import React from 'react';
import { CalendarDays, CalendarRange, History, Download } from 'lucide-react';

export type ReportTabId = 'weekly' | 'monthly' | 'history' | 'export';

interface ReportTabsProps {
  activeTab: ReportTabId;
  onSelectTab: (tab: ReportTabId) => void;
}

export const ReportTabs: React.FC<ReportTabsProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: ReportTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'weekly', label: 'Weekly', icon: <CalendarDays size={16} /> },
    { id: 'monthly', label: 'Monthly', icon: <CalendarRange size={16} /> },
    { id: 'history', label: 'History', icon: <History size={16} /> },
    { id: 'export', label: 'Export', icon: <Download size={16} /> }
  ];

  return (
    <div className="report-tabs-nav no-print" role="tablist" aria-label="Report Views">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`report-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="report-tab-icon">{tab.icon}</span>
            <span className="report-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
