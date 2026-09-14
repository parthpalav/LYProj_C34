/**
 * server/config/familyRules.js
 *
 * Central configuration constants for the FINAURA Family System.
 */

export const MAX_FAMILY_MEMBERS = 6;
export const FAMILY_INVITE_EXPIRY_DAYS = 7;

/**
 * Derives a deterministic canonical pairKey for two user IDs
 * regardless of inviter/invitee direction.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string} e.g. "u-100:u-200"
 */
export function makePairKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}
