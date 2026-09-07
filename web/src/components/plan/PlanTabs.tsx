import React from 'react';

export type PlanTabKey = 'net-worth' | 'assets' | 'goals' | 'fire' | 'scenarios';

interface PlanTabsProps {
  activeTab: PlanTabKey;
  onTabChange: (tab: PlanTabKey) => void;
}

const TABS: Array<{ key: PlanTabKey; label: string; icon: string }> = [
  { key: 'net-worth', label: 'Net Worth', icon: '🏛️' },
  { key: 'assets', label: 'Assets', icon: '📈' },
  { key: 'goals', label: 'Goals', icon: '🎯' },
  { key: 'fire', label: 'FIRE', icon: '🔥' },
  { key: 'scenarios', label: 'Scenario Lab', icon: '🧪' },
];

export const PlanTabs: React.FC<PlanTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="plan-tabs-container" role="tablist" aria-label="Planning Workspace Navigation">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            className={`plan-tab-button ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            type="button"
          >
            <span className="plan-tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="plan-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
