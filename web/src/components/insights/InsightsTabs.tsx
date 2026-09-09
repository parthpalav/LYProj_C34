import React from 'react';
import { ReceiptText, Activity, Radar, LineChart } from 'lucide-react';

export type InsightsTab = 'spending' | 'fmi' | 'behaviour' | 'income';

export interface InsightsTabsProps {
  activeTab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
}

export const InsightsTabs: React.FC<InsightsTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs: Array<{
    id: InsightsTab;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'spending',
      label: 'Spending',
      sublabel: 'Cash Outflows',
      icon: <ReceiptText size={16} aria-hidden="true" />,
    },
    {
      id: 'fmi',
      label: 'FMI Health',
      sublabel: 'Financial Momentum',
      icon: <Activity size={16} aria-hidden="true" />,
    },
    {
      id: 'behaviour',
      label: 'Behaviour',
      sublabel: 'Risk & Anomalies',
      icon: <Radar size={16} aria-hidden="true" />,
    },
    {
      id: 'income',
      label: 'Income',
      sublabel: 'Inflow Stability',
      icon: <LineChart size={16} aria-hidden="true" />,
    },
  ];

  return (
    <div className="activity-tabs-container" role="tablist" aria-label="Insights Sections">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`activity-tab-btn ${isActive ? 'activity-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label-group">
              <span className="tab-label">{tab.label}</span>
              <span className="tab-sublabel">{tab.sublabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
