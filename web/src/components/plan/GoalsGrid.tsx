import React from 'react';
import { Target, Plus } from 'lucide-react';
import type { Goal } from '../../types';
import { GoalCard } from './GoalCard';

interface GoalsGridProps {
  goals: Goal[];
  totalTargetAmount: number;
  totalSavedAmount: number;
  overallProgressPercentage: number;
  onAddGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goal: Goal) => void;
}

function formatINR(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const GoalsGrid: React.FC<GoalsGridProps> = ({
  goals,
  totalTargetAmount,
  totalSavedAmount,
  overallProgressPercentage,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
}) => {
  return (
    <div className="plan-goals-section">
      {/* Summary Header */}
      <div className="plan-surface-card plan-section-header--row">
        <div className="plan-goals-summary-info">
          <h3 className="plan-section-title">Financial Goals</h3>
          <p className="plan-section-subtitle">
            Track and fund your specific milestones, buffers, and life achievements
          </p>
          <div className="plan-goals-metrics">
            <div className="plan-goals-stat">
              <span className="plan-goals-stat-label">Active Goals</span>
              <span className="plan-goals-stat-value">{goals.length}</span>
            </div>
            <div className="plan-goals-stat">
              <span className="plan-goals-stat-label">Total Target</span>
              <span className="plan-goals-stat-value">{formatINR(totalTargetAmount)}</span>
            </div>
            <div className="plan-goals-stat">
              <span className="plan-goals-stat-label">Total Saved</span>
              <span className="plan-goals-stat-value plan-goals-stat-value--saved">{formatINR(totalSavedAmount)}</span>
            </div>
            <div className="plan-goals-stat">
              <span className="plan-goals-stat-label">Overall Progress</span>
              <span className="plan-goals-stat-value">{overallProgressPercentage}%</span>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-primary plan-add-btn" onClick={onAddGoal}>
          <Plus size={15} /> Create Goal
        </button>
      </div>

      {/* Goals Cards Grid */}
      {goals.length === 0 ? (
        <div className="plan-empty-state">
          <Target size={40} className="plan-empty-icon" />
          <h4 className="plan-empty-title">No financial goals created yet</h4>
          <p className="plan-empty-desc">
            Create a financial goal to begin tracking progress.
          </p>
          <button type="button" className="btn btn-primary" onClick={onAddGoal}>
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="plan-goals-grid">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={onEditGoal}
              onDelete={onDeleteGoal}
            />
          ))}
        </div>
      )}
    </div>
  );
};
