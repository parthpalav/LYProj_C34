import React from 'react';
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
    <div className="goals-section-container">
      {/* Summary Header */}
      <div className="goals-summary-card">
        <div className="goals-summary-info">
          <h3 className="goals-title">Financial Goals</h3>
          <p className="goals-subtitle">
            Track and fund your specific milestones, buffers, and life achievements
          </p>
          <div className="goals-metrics-row">
            <div className="goal-stat-item">
              <span className="stat-label">Active Goals</span>
              <span className="stat-value">{goals.length}</span>
            </div>
            <div className="goal-stat-item">
              <span className="stat-label">Total Target</span>
              <span className="stat-value">{formatINR(totalTargetAmount)}</span>
            </div>
            <div className="goal-stat-item">
              <span className="stat-label">Total Saved</span>
              <span className="stat-value val-saved">{formatINR(totalSavedAmount)}</span>
            </div>
            <div className="goal-stat-item">
              <span className="stat-label">Overall Progress</span>
              <span className="stat-value">{overallProgressPercentage}%</span>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-primary add-goal-btn" onClick={onAddGoal}>
          + Create New Goal
        </button>
      </div>

      {/* Goals Cards Grid */}
      {goals.length === 0 ? (
        <div className="goals-empty-state">
          <div className="empty-icon">🎯</div>
          <h4 className="empty-title">No financial goals created yet</h4>
          <p className="empty-desc">
            Define specific milestones like an Emergency Fund, Vacation, or Downpayment to organize your savings.
          </p>
          <button type="button" className="btn btn-primary" onClick={onAddGoal}>
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="goals-cards-grid">
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
