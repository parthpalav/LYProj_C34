import React, { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { PlanTabs, type PlanTabKey } from '../components/plan/PlanTabs';

// Goals Components
import { GoalsGrid } from '../components/plan/GoalsGrid';
import { GoalModal } from '../components/plan/GoalModal';
import { FundGoalModal } from '../components/plan/FundGoalModal';

// FIRE Components
import { FireHeroSummary } from '../components/plan/FireHeroSummary';
import { FireScenariosTable } from '../components/plan/FireScenariosTable';
import { FireContributionPanel } from '../components/plan/FireContributionPanel';
import { EmergencyFundPanel } from '../components/plan/EmergencyFundPanel';
import { MonteCarloPanel } from '../components/plan/MonteCarloPanel';

// Scenario Lab Components
import { ScenarioPresets } from '../components/plan/ScenarioPresets';
import { ScenarioControls } from '../components/plan/ScenarioControls';
import { ScenarioComparisonView } from '../components/plan/ScenarioComparisonView';

// Hooks
import { useGoals } from '../hooks/useGoals';
import { useFirePlan } from '../hooks/useFirePlan';
import { useScenarioLab } from '../hooks/useScenarioLab';

// UI
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import type { Goal } from '../types';

const TabLoadingSkeleton: React.FC<{ height?: string }> = ({ height = '260px' }) => (
  <div className="plan-skeleton" style={{ height }}>
    <div className="plan-skeleton-inner">
      <div className="plan-spinner" />
      <span>Loading planning analytics…</span>
    </div>
  </div>
);

export const PlanPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Tab state (default: goals). Net worth and assets moved to their own page.
  const tabParam = searchParams.get('tab');
  const activeTab = useMemo<PlanTabKey>(
    () => (tabParam === 'fire' || tabParam === 'scenarios' ? tabParam : 'goals'),
    [tabParam],
  );

  const handleTabChange = (newTab: PlanTabKey) => {
    setSearchParams({ tab: newTab });
  };

  // Domain Hooks
  const goalsDomain = useGoals();
  const fireDomain = useFirePlan();
  const scenarioLab = useScenarioLab();

  // Modals state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<Goal | null>(null);

  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [goalToFund, setGoalToFund] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);

  // Goal Actions
  const handleOpenAddGoal = () => {
    setGoalToEdit(null);
    setGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: Goal) => {
    setGoalToEdit(goal);
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (payload: any) => {
    if (goalToEdit) {
      await goalsDomain.editGoal(goalToEdit.id, payload);
    } else {
      await goalsDomain.addGoal(payload);
    }
  };

  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    try {
      setDeletingGoal(true);
      await goalsDomain.removeGoal(goalToDelete.id);
      setGoalToDelete(null);
    } finally {
      setDeletingGoal(false);
    }
  };

  // Global Refresh for current tab
  const handleGlobalRefresh = () => {
    if (activeTab === 'goals') {
      void goalsDomain.refresh(true);
    } else if (activeTab === 'fire') {
      void fireDomain.refresh(true);
    } else if (activeTab === 'scenarios') {
      scenarioLab.resetToBaseline();
    }
  };

  if (tabParam === 'assets') return <Navigate to="/app/net-worth?tab=assets" replace />;
  if (tabParam === 'net-worth') return <Navigate to="/app/net-worth?tab=breakdown" replace />;

  return (
    <div className="plan-page">
      {/* Page Header */}
      <div className="page-header-section">
        <div>
          <span className="page-header-eyebrow">WEALTH PLANNING</span>
          <h1 className="page-header-title">Plan</h1>
          <p className="page-header-subtitle">
            Model your financial trajectory and prepare for long-term goals.
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGlobalRefresh}
            className="refresh-btn"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <PlanTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* TAB CONTENT AREAS */}
      <div className="plan-tab-content">
        {/* 3. GOALS TAB */}
        {activeTab === 'goals' && (
          <div className="plan-tab-pane plan-tab-pane--enter">
            {goalsDomain.loading ? (
              <TabLoadingSkeleton height="380px" />
            ) : goalsDomain.error ? (
              <div className="plan-surface-card plan-error-card">
                <h4>Error loading Goals</h4>
                <p>{goalsDomain.error}</p>
                <Button variant="outline" size="sm" onClick={() => goalsDomain.refresh(true)}>
                  Retry
                </Button>
              </div>
            ) : (
              <GoalsGrid
                goals={goalsDomain.goals}
                totalTargetAmount={goalsDomain.totalTargetAmount}
                totalSavedAmount={goalsDomain.totalSavedAmount}
                overallProgressPercentage={goalsDomain.overallProgressPercentage}
                onAddGoal={handleOpenAddGoal}
                onEditGoal={handleOpenEditGoal}
                onDeleteGoal={(goal) => setGoalToDelete(goal)}
                onFundGoal={(goal) => setGoalToFund(goal)}
              />
            )}
          </div>
        )}

        {/* 4. FIRE TAB */}
        {activeTab === 'fire' && (
          <div className="plan-tab-pane plan-tab-pane--enter">
            {fireDomain.loading ? (
              <TabLoadingSkeleton height="420px" />
            ) : fireDomain.error ? (
              <div className="plan-surface-card plan-error-card">
                <h4>Error loading FIRE Projections</h4>
                <p>{fireDomain.error}</p>
                <Button variant="outline" size="sm" onClick={() => fireDomain.refresh(true)}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <FireHeroSummary
                  targetFireCorpus={fireDomain.targetFireCorpus}
                  currentFireCorpus={fireDomain.currentFireCorpus}
                  currentAge={fireDomain.currentAge}
                  targetRetirementAge={fireDomain.targetRetirementAge}
                  projectedFireAge={fireDomain.projectedFireAge}
                  isFireReached={fireDomain.isFireReached}
                  projectedCorpusAtRetirement={fireDomain.projectedCorpusAtRetirement}
                  fireProgressPercentage={fireDomain.fireProgressPercentage}
                />
                <FireScenariosTable scenarios={fireDomain.scenarios} />
                <FireContributionPanel
                  requiredMonthlyContribution={fireDomain.requiredMonthlyContribution}
                  currentMonthlyContribution={fireDomain.currentMonthlyContribution}
                  contributionGap={fireDomain.contributionGap}
                />
                <EmergencyFundPanel
                  emergencyFund={fireDomain.emergencyFund}
                  liabilityOverhang={fireDomain.liabilityOverhang}
                />
                <MonteCarloPanel
                  probabilistic={fireDomain.probabilistic}
                  explanationFacts={fireDomain.snapshot?.explanationFacts}
                />
              </>
            )}
          </div>
        )}

        {/* 5. SCENARIO LAB TAB */}
        {activeTab === 'scenarios' && (
          <div className="plan-tab-pane plan-tab-pane--enter">
            {scenarioLab.loadingBaseline ? (
              <TabLoadingSkeleton height="420px" />
            ) : scenarioLab.error && !scenarioLab.baselineSnapshot ? (
              <div className="plan-surface-card plan-error-card">
                <h4>Error loading Scenario Lab</h4>
                <p>{scenarioLab.error}</p>
                <Button variant="outline" size="sm" onClick={() => scenarioLab.resetToBaseline()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <ScenarioPresets
                  onApplyPreset={scenarioLab.applyPreset}
                  disabled={scenarioLab.evaluating}
                />
                <ScenarioControls
                  currentAge={scenarioLab.currentAge}
                  monthlyContribution={scenarioLab.monthlyContribution}
                  setMonthlyContribution={scenarioLab.setMonthlyContribution}
                  retirementAge={scenarioLab.retirementAge}
                  setRetirementAge={scenarioLab.setRetirementAge}
                  expectedReturnRate={scenarioLab.expectedReturnRate}
                  setExpectedReturnRate={scenarioLab.setExpectedReturnRate}
                  expectedInflationRate={scenarioLab.expectedInflationRate}
                  setExpectedInflationRate={scenarioLab.setExpectedInflationRate}
                  annualContributionGrowthRate={scenarioLab.annualContributionGrowthRate}
                  setAnnualContributionGrowthRate={scenarioLab.setAnnualContributionGrowthRate}
                  contributionMode={scenarioLab.contributionMode}
                  setContributionMode={scenarioLab.setContributionMode}
                  onRunScenario={() => scenarioLab.runScenario()}
                  onReset={scenarioLab.resetToBaseline}
                  evaluating={scenarioLab.evaluating}
                />
                {scenarioLab.error && (
                  <div className="plan-eval-error flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <span>Evaluation notice: {scenarioLab.error}</span>
                  </div>
                )}
                <ScenarioComparisonView
                  baselineSnapshot={scenarioLab.baselineSnapshot}
                  scenarioSnapshot={scenarioLab.scenarioSnapshot}
                  deltas={scenarioLab.deltas}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Goal Modals */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onSave={handleSaveGoal}
        goalToEdit={goalToEdit}
      />

      <FundGoalModal
        goal={goalToFund}
        onClose={() => setGoalToFund(null)}
        onSave={async (goal, newSaved) => { await goalsDomain.editGoal(goal.id, { savedAmount: newSaved }); }}
      />

      <ConfirmDialog
        isOpen={Boolean(goalToDelete)}
        onClose={() => setGoalToDelete(null)}
        onConfirm={handleConfirmDeleteGoal}
        title="Delete Financial Goal"
        message={`Are you sure you want to delete the goal "${goalToDelete?.name}"?`}
        warningNote="Tracking for this milestone will be removed."
        confirmLabel="Delete Goal"
        isLoading={deletingGoal}
      />
    </div>
  );
};
