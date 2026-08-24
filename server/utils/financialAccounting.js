/**
 * server/utils/financialAccounting.js
 * 
 * Deterministic helper functions enforcing the FINAURA cash-flow taxonomy:
 * 
 * Income = Consumption + Debt Service + Investment / Savings + Taxes + Unallocated Cash
 * 
 * Invariants:
 *  - Consumption = Needs + Wants (excluding liability payments/debt service)
 *  - Debt Service = Payments linked to a Liability (liabilityId is present)
 *  - Investment / Savings = Money moved into financial assets (type === 'Investment')
 */

/**
 * Determines whether a transaction represents consumption (Need or Want, not linked to a liability).
 * @param {Object} tx - Transaction document
 * @returns {boolean}
 */
export function isConsumption(tx) {
  if (!tx) return false;
  return (tx.type === 'Need' || tx.type === 'Want') && !tx.liabilityId;
}

/**
 * Determines whether a transaction is an investment/saving.
 * @param {Object} tx - Transaction document
 * @returns {boolean}
 */
export function isInvestment(tx) {
  if (!tx) return false;
  return tx.type === 'Investment';
}

/**
 * Determines whether a transaction represents debt service (linked to a liability).
 * @param {Object} tx - Transaction document
 * @returns {boolean}
 */
export function isDebtService(tx) {
  if (!tx) return false;
  return !!tx.liabilityId;
}

/**
 * Classifies cash-flow direction (inflow vs outflow).
 * Income is an inflow; all transactions in FINAURA are outflows (debits).
 * @param {Object} record - Income or Transaction record
 * @returns {string} 'inflow' | 'outflow' | 'unknown'
 */
export function getCashFlowDirection(record) {
  if (!record) return 'unknown';
  // Income records have a 'source' property (salary, gig, freelance, other)
  if (record.source !== undefined) {
    return 'inflow';
  }
  // Transactions are always debits/outflows
  return 'outflow';
}
