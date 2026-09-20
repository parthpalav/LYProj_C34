import React from 'react';
import { Users, UserPlus, Shield, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '../ui/Button';

export interface NoFamilyCardProps {
  onOpenInviteModal: () => void;
}

export const NoFamilyCard: React.FC<NoFamilyCardProps> = ({ onOpenInviteModal }) => {
  return (
    <div className="no-family-card">
      <div className="no-family-grid">
        {/* Left Column: Value Proposition & Invariants */}
        <div className="no-family-info">
          <div className="no-family-badge">
            <Sparkles size={14} />
            <span>Shared Household Intelligence</span>
          </div>

          <h2 className="no-family-title">
            Build a shared household view without merging accounts.
          </h2>

          <p className="no-family-description">
            Family members keep their own transactions, balances and personal FMI. FINAURA only combines household-level financial signals to evaluate collective discipline and cash flow.
          </p>

          <div className="no-family-pillars">
            <div className="no-family-pillar-item">
              <div className="no-family-pillar-icon">
                <Shield size={16} />
              </div>
              <div>
                <strong className="no-family-pillar-title">100% Privacy-Preserving</strong>
                <p className="no-family-pillar-desc">
                  Zero raw transaction exposure. No one sees your individual purchases, income, or accounts.
                </p>
              </div>
            </div>

            <div className="no-family-pillar-item">
              <div className="no-family-pillar-icon">
                <TrendingUp size={16} />
              </div>
              <div>
                <strong className="no-family-pillar-title">Household Financial Maturity</strong>
                <p className="no-family-pillar-desc">
                  Understand combined saving discipline, spending control, and cash flow pacing in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Call to Action Hero Card */}
        <div className="no-family-action-card">
          <div className="no-family-action-icon-circle">
            <Users size={32} />
          </div>

          <h3 className="no-family-action-title">Start Your Household</h3>
          <p className="no-family-action-text">
            Invite your partner or family member to start seeing combined financial insights.
          </p>

          <Button
            variant="primary"
            size="lg"
            onClick={onOpenInviteModal}
            leftIcon={<UserPlus size={18} />}
            className="no-family-invite-btn"
          >
            Invite Family Member
          </Button>

          <span className="no-family-action-note">
            The first accepted invitation will create your Family. Up to 6 members supported.
          </span>
        </div>
      </div>
    </div>
  );
};
