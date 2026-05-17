import { evaluateRetirementGoal } from './retirementGoalService.js';
import { buildRecommendations } from './recommendationService.js';

function currency(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function generateChatbotResponse({ user, message, baseline, fmi, monthlySplit }) {
  const text = (message || '').toLowerCase();
  const retirement = evaluateRetirementGoal(user);
  const recommendations = buildRecommendations({ user, retirement, fmi, monthlySplit });

  if (text.includes('how much should i save') || text.includes('retirement')) {
    return retirement.summary + ' ' + retirement.guidance.join(' ');
  }

  if (text.includes('fmi') || text.includes('mood')) {
    if (!fmi?.score) return 'Your FMI is still learning. Keep logging expenses for a clearer score.';
    return `Your FMI is ${fmi.score} (${fmi.band}). ${fmi.reasons?.[0] || 'Keep balancing needs, wants, and investments.'}`;
  }

  if (text.includes('spend') && text.includes('this week')) {
    const wants = monthlySplit?.WANT || 0;
    const needs = monthlySplit?.NEED || 0;
    if (wants > needs) {
      return 'This week wants are ahead of needs. Consider slowing discretionary spends to protect your goals.';
    }
    return 'Your spend mix looks balanced. Keep needs prioritized and review larger wants.';
  }

  if (text.includes('wedding') || text.includes('event')) {
    return 'For event-based goals, compute monthly savings needed and align them with your retirement plan. Focus on reducing discretionary spending first.';
  }

  return recommendations.join(' ');
}
import { evaluateRetirementGoal } from './retirementGoalService.js';
import { buildRecommendations } from './recommendationService.js';

function currency(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function generateChatbotResponse({ user, message, baseline, fmi, monthlySplit }) {
  const text = (message || '').toLowerCase();
  const retirement = evaluateRetirementGoal(user);
  const recommendations = buildRecommendations({ user, retirement, fmi, monthlySplit });

  if (text.includes('how much should i save') || text.includes('retirement')) {
    return retirement.summary + ' ' + retirement.guidance.join(' ');
  }

  if (text.includes('fmi') || text.includes('mood')) {
    if (!fmi?.score) return 'Your FMI is still learning. Keep logging expenses for a clearer score.';
    return `Your FMI is ${fmi.score} (${fmi.band}). ${fmi.reasons?.[0] || 'Keep balancing needs, wants, and investments.'}`;
  }

  if (text.includes('spend') && text.includes('this week')) {
    const wants = monthlySplit?.WANT || 0;
    const needs = monthlySplit?.NEED || 0;
    if (wants > needs) {
      return 'This week wants are ahead of needs. Consider slowing discretionary spends to protect your goals.';
    }
    return 'Your spend mix looks balanced. Keep needs prioritized and review larger wants.';
  }

  if (text.includes('wedding') || text.includes('event')) {
    return 'For event-based goals, compute monthly savings needed and align them with your retirement plan. Focus on reducing discretionary spending first.';
  }

  return recommendations.join(' ');
}
