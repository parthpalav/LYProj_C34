import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Goal } from '../../types';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

function formatINR(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onEdit, onDelete }) => {
  const target = Number(goal.targetAmount) || 0;
  const saved = Number(goal.savedAmount) || 0;

  // Presentation math only
  const progressPct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const remaining = Math.max(0, target - saved);

  const formattedDate = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="plan-goal-card">
      <div className="plan-goal-card-header">
        <div className="plan-goal-identity">
          <span className="plan-goal-emoji" role="img" aria-label="Goal icon">
            {goal.emoji || '🎯'}
          </span>
          <div className="plan-goal-title-group">
            <h4 className="plan-goal-name">{goal.name}</h4>
            {formattedDate && <span className="plan-goal-date">Target: {formattedDate}</span>}
          </div>
        </div>
        <div className="plan-goal-actions">
          <button
            type="button"
            className="plan-icon-btn plan-icon-btn--edit"
            onClick={() => onEdit(goal)}
            aria-label={`Edit ${goal.name}`}
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="plan-icon-btn plan-icon-btn--delete"
            onClick={() => onDelete(goal)}
            aria-label={`Delete ${goal.name}`}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="plan-goal-values">
        <div>
          <span className="plan-goal-val-label">Saved</span>
          <span className="plan-goal-val-number plan-goal-val-number--saved">{formatINR(saved)}</span>
        </div>
        <div className="text-right">
          <span className="plan-goal-val-label">Target</span>
          <span className="plan-goal-val-number">{formatINR(target)}</span>
        </div>
      </div>

      <div className="plan-goal-progress-track">
        <div
          className={`plan-goal-progress-fill ${progressPct >= 100 ? 'plan-goal-progress-fill--complete' : ''}`}
          style={{ '--goal-progress-width': `${progressPct}%` } as React.CSSProperties}
        />
      </div>

      <div className="plan-goal-footer">
        <span className="plan-goal-progress-text">
          {progressPct >= 100 ? 'Goal Achieved!' : `${progressPct}% complete`}
        </span>
        {progressPct < 100 && (
          <span className="plan-goal-remaining">
            {formatINR(remaining)} to go
          </span>
        )}
      </div>

      {goal.monthlyContribution !== undefined && goal.monthlyContribution > 0 && (
        <div className="plan-goal-monthly">
          <span>Monthly saving: <strong>{formatINR(goal.monthlyContribution)}</strong></span>
        </div>
      )}
    </div>
  );
};
