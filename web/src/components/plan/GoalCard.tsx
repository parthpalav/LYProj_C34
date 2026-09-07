import React from 'react';
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

  // Correction #6: Presentation math only
  const progressPct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const remaining = Math.max(0, target - saved);

  const formattedDate = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="goal-card">
      <div className="goal-card-header">
        <div className="goal-identity">
          <span className="goal-emoji" role="img" aria-label="Goal icon">
            {goal.emoji || '🎯'}
          </span>
          <div className="goal-title-group">
            <h4 className="goal-name">{goal.name}</h4>
            {formattedDate && <span className="goal-date">Target: {formattedDate}</span>}
          </div>
        </div>
        <div className="goal-actions">
          <button
            type="button"
            className="btn-action edit"
            onClick={() => onEdit(goal)}
            aria-label={`Edit ${goal.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-action delete"
            onClick={() => onDelete(goal)}
            aria-label={`Delete ${goal.name}`}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="goal-values-row">
        <div>
          <span className="val-label">Saved</span>
          <span className="val-number val-saved">{formatINR(saved)}</span>
        </div>
        <div className="text-right">
          <span className="val-label">Target</span>
          <span className="val-number">{formatINR(target)}</span>
        </div>
      </div>

      <div className="goal-progress-bar-track">
        <div
          className={`goal-progress-bar-fill ${progressPct >= 100 ? 'complete' : ''}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="goal-card-footer">
        <span className="goal-progress-text">
          {progressPct >= 100 ? '🎉 Goal Achieved!' : `${progressPct}% complete`}
        </span>
        {progressPct < 100 && (
          <span className="goal-remaining-text">
            {formatINR(remaining)} to go
          </span>
        )}
      </div>

      {goal.monthlyContribution !== undefined && goal.monthlyContribution > 0 && (
        <div className="goal-monthly-commitment">
          <span>Monthly saving: <strong>{formatINR(goal.monthlyContribution)}</strong></span>
        </div>
      )}
    </div>
  );
};
