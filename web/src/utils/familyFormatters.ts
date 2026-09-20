/**
 * Family formatting and display helper utilities for FINAURA Web
 */

export function getFmiColor(score: number): string {
  if (score >= 80) return '#059669';
  if (score >= 65) return '#10B981';
  if (score >= 50) return '#d97706';
  if (score >= 35) return '#f59e0b';
  return '#dc2626';
}

export function getFmiBadgeBg(score: number): string {
  if (score >= 80) return '#ecfdf5';
  if (score >= 65) return '#ecfdf5';
  if (score >= 50) return '#fffbeb';
  if (score >= 35) return '#fffbeb';
  return '#fef2f2';
}

export function formatExpiry(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'expired';
    if (diffDays === 1) return 'in 1 day';
    return `in ${diffDays} days`;
  } catch {
    return '';
  }
}

export function getMemberInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'FM';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function getHumanReadableFamilyError(err: unknown, fallback = 'Operation failed. Please try again.'): string {
  const errorObj = err as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
  const status = errorObj?.response?.status;
  const serverMsg = errorObj?.response?.data?.message || errorObj?.response?.data?.error || '';
  const msgLower = typeof serverMsg === 'string' ? serverMsg.toLowerCase() : '';

  if (status === 429 || msgLower.includes('too many requests')) {
    return 'Too many requests. Please try again shortly.';
  }
  if (status === 404 || msgLower.includes('user not found') || msgLower.includes('account was found')) {
    return 'No FINAURA account was found with that email.';
  }
  if (msgLower.includes('cannot invite yourself') || msgLower.includes("can't invite your own") || msgLower.includes('self-invitation')) {
    return "You can't invite your own account.";
  }
  if (msgLower.includes('already belongs to a family') || (status === 409 && msgLower.includes('already belongs'))) {
    return 'This user already belongs to a Family.';
  }
  if (msgLower.includes('already exists') || msgLower.includes('already pending') || msgLower.includes('active invitation already exists')) {
    return 'A Family invitation is already pending for this user.';
  }
  if (status === 403 || msgLower.includes('only the family owner') || msgLower.includes('only owner')) {
    return 'Only the Family owner can perform this action.';
  }
  if (msgLower.includes('maximum 6') || msgLower.includes('family is full') || msgLower.includes('limit reached')) {
    return 'This Family has reached the 6-member limit.';
  }
  if (errorObj?.message === 'Network Error' || !errorObj?.response) {
    return 'Unable to reach FINAURA. Please check your connection.';
  }
  return serverMsg || fallback;
}
