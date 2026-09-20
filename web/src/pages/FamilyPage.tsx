import React, { useState } from 'react';
import { RotateCcw, UserPlus, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { FamilyPrivacyBanner } from '../components/family/FamilyPrivacyBanner';
import { NoFamilyCard } from '../components/family/NoFamilyCard';
import { FamilyInvitationsSection } from '../components/family/FamilyInvitationsSection';
import { FamilyFmiHero } from '../components/family/FamilyFmiHero';
import { FamilyPillarsGrid } from '../components/family/FamilyPillarsGrid';
import { HouseholdMetricsGrid } from '../components/family/HouseholdMetricsGrid';
import { HouseholdCashFlowBreakdown } from '../components/family/HouseholdCashFlowBreakdown';
import { HouseholdCategoryBreakdown } from '../components/family/HouseholdCategoryBreakdown';
import { HouseholdInsightsCard } from '../components/family/HouseholdInsightsCard';
import { FamilyMemberList } from '../components/family/FamilyMemberList';
import { InviteMemberModal } from '../components/family/InviteMemberModal';

export const FamilyPage: React.FC = () => {
  const { user } = useAuth();
  const {
    family,
    dashboard,
    receivedInvitations,
    sentInvitations,
    members,
    isLoading,
    isRefreshing,
    error,
    actionLoadingId,
    isOwner,
    memberCount,
    isFamilyFull,
    refresh,
    sendInvite,
    acceptInvite,
    declineInvite,
    cancelInvite,
    removeMember,
    leaveFamily,
  } = useFamily();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Loading Skeletons
  if (isLoading && !isRefreshing) {
    return (
      <div className="family-page">
        <PageHeader
          category="Household Aggregation"
          title="Family & Household"
          description="A shared view of your household finances — while keeping every member's personal account private."
        />
        <div className="family-loading-stack">
          <SkeletonCard height={80} />
          <SkeletonCard height={240} />
          <div className="family-grid-two-col">
            <SkeletonCard height={200} />
            <SkeletonCard height={200} />
          </div>
          <SkeletonCard height={220} />
        </div>
      </div>
    );
  }

  const fmi = dashboard?.fmi;

  return (
    <div className="family-page">
      {/* ── Page Header ────────────────────────────────────────── */}
      <PageHeader
        category="Household Aggregation"
        title="Family & Household"
        description="A shared view of your household finances — while keeping every member's personal account private."
        actions={
          <div className="family-header-actions">
            {family && isOwner && !isFamilyFull && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                leftIcon={<UserPlus size={15} />}
              >
                Invite Member
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={isRefreshing}
              leftIcon={<RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {/* ── Error Banner ───────────────────────────────────────── */}
      {error && (
        <div className="family-error-banner" role="alert">
          <AlertCircle size={18} className="family-error-icon" />
          <div className="family-error-msg">{error}</div>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Privacy Assurance Banner ───────────────────────────── */}
      <FamilyPrivacyBanner />

      {/* ── Pending Received & Sent Invitations ─────────────────── */}
      <FamilyInvitationsSection
        receivedInvitations={receivedInvitations}
        sentInvitations={sentInvitations}
        actionLoadingId={actionLoadingId}
        onAccept={acceptInvite}
        onDecline={declineInvite}
        onCancel={cancelInvite}
      />

      {/* ── Main View: State A (No Family) vs State C (Active) ─── */}
      {!family ? (
        <NoFamilyCard onOpenInviteModal={() => setIsInviteModalOpen(true)} />
      ) : (
        <div className="family-active-dashboard">
          {/* Family Identity Subheader */}
          <div className="family-identity-strip">
            <div className="family-identity-left">
              <div className="family-identity-badge">
                <Users size={20} />
              </div>
              <div>
                <h2 className="family-identity-name">{family.name || 'My Family'}</h2>
                <span className="family-identity-meta">
                  {memberCount} active member{memberCount === 1 ? '' : 's'} · Limit 6
                </span>
              </div>
            </div>

            <div className={`family-role-pill ${isOwner ? 'owner' : 'member'}`}>
              {isOwner ? 'Household Owner' : 'Household Member'}
            </div>
          </div>

          {/* Row 1: Family FMI Hero & Household Financial Metrics */}
          {fmi && (
            <div className="family-hero-section">
              <FamilyFmiHero fmi={fmi} />
            </div>
          )}

          {/* Row 2: FMI Pillars (Saving Discipline, Spending Control, Behavioral Stability) */}
          {fmi && <FamilyPillarsGrid fmi={fmi} />}

          {/* Row 3: Household Financial Snapshot (Effective Income, Spend, Invested, Rate, Net Cash) */}
          {dashboard && <HouseholdMetricsGrid dashboard={dashboard} />}

          {/* Row 4: Cash Flow Composition & Top Categories (2-col grid on desktop) */}
          {dashboard && (
            <div className="family-grid-two-col">
              <HouseholdCashFlowBreakdown typeBreakdown={dashboard.typeBreakdown} />
              <HouseholdCategoryBreakdown categories={dashboard.categoryBreakdown} />
            </div>
          )}

          {/* Row 5: Deterministic Household Insights */}
          {fmi && <HouseholdInsightsCard insights={fmi.insights} />}

          {/* Row 6: Household Members Roster & Management */}
          <FamilyMemberList
            members={members}
            currentUserId={user?.id || user?._id}
            isOwner={isOwner}
            isFamilyFull={isFamilyFull}
            actionLoadingId={actionLoadingId}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onRemoveMember={removeMember}
            onLeaveFamily={leaveFamily}
          />
        </div>
      )}

      {/* ── Invite Family Member Modal ─────────────────────────── */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSendInvite={sendInvite}
      />
    </div>
  );
};
