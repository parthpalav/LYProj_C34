import React from 'react';
import { Wallet, Landmark, Target, Flame, FlaskConical } from 'lucide-react';

export type PlanTabKey = 'net-worth' | 'assets' | 'goals' | 'fire' | 'scenarios';

interface PlanTabsProps {
  activeTab: PlanTabKey;
  onTabChange: (tab: PlanTabKey) => void;
}

const TABS: Array<{ key: PlanTabKey; label: string; Icon: React.FC<any> }> = [
  { key: 'net-worth', label: 'Net Worth', Icon: Wallet },
  { key: 'assets', label: 'Assets', Icon: Landmark },
  { key: 'goals', label: 'Goals', Icon: Target },
  { key: 'fire', label: 'FIRE', Icon: Flame },
  { key: 'scenarios', label: 'Scenario Lab', Icon: FlaskConical },
];

export const PlanTabs: React.FC<PlanTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="unified-tab-container" role="tablist" aria-label="Planning Workspace Navigation">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            className={`unified-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            type="button"
          >
            <tab.Icon size={15} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
