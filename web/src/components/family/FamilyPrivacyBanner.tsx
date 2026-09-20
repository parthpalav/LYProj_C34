import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const FamilyPrivacyBanner: React.FC = () => {
  return (
    <div className="family-privacy-banner" role="region" aria-label="Privacy Guarantee">
      <div className="family-privacy-icon-wrap">
        <ShieldCheck size={20} className="family-privacy-icon" />
      </div>
      <div className="family-privacy-text-wrap">
        <h4 className="family-privacy-title">Your personal financial records stay private</h4>
        <p className="family-privacy-body">
          Family members see household-level aggregates, not each other’s individual transactions.
          Personal FMI, income sources, liabilities, and retirement goals remain strictly yours.
        </p>
      </div>
    </div>
  );
};
