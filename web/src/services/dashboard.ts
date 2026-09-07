import type {
  Transaction,
  IncomeRecord,
  Liability,
  CashFlowMonth,
} from '../types';
import { getTransactionDate } from '../utils/formatters';

/**
 * Computes trailing 6 calendar months of Cash Flow (Income, Expenses, Net Flow)
 * purely for chart visualization.
 * Uses local calendar months to match the user's time zone.
 */
export function buildCashFlowHistory(
  transactions: Transaction[],
  incomes: IncomeRecord[],
  monthCount: number = 6
): CashFlowMonth[] {
  const result: CashFlowMonth[] = [];
  const now = new Date();

  // Generate ordered list of month intervals from oldest to current
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthLabel = new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      year: 'numeric',
    }).format(d);

    // Sum income in this month
    const monthIncome = incomes
      .filter((inc) => {
        const incDate = inc.timestamp ? new Date(inc.timestamp) : null;
        return incDate && !isNaN(incDate.getTime()) && incDate >= startOfMonth && incDate <= endOfMonth;
      })
      .reduce((sum, inc) => sum + Math.abs(Number(inc.amount) || 0), 0);

    // Sum expenses in this month (stored positive)
    const monthExpenses = transactions
      .filter((tx) => {
        const txDate = getTransactionDate(tx);
        return txDate >= startOfMonth && txDate <= endOfMonth;
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);

    result.push({
      monthKey,
      monthLabel,
      income: Math.round(monthIncome),
      expenses: Math.round(monthExpenses),
      netFlow: Math.round(monthIncome - monthExpenses),
    });
  }

  return result;
}

/**
 * Calculates current month's display savings rate strictly for UI card presentation.
 * Returns null if income is 0 or negative to prevent NaN / division errors.
 */
export function calculateCurrentMonthSavingsRate(
  currentMonthIncome: number,
  currentMonthSpending: number
): number | null {
  if (currentMonthIncome <= 0) {
    return null;
  }
  const rawRate = ((currentMonthIncome - currentMonthSpending) / currentMonthIncome) * 100;
  return Math.max(0, Math.min(100, Math.round(rawRate)));
}

/**
 * Filters and sorts active liabilities by nearest upcoming due date.
 */
export function getSortedUpcomingLiabilities(
  liabilities: Liability[],
  limit: number = 5
): Liability[] {
  return liabilities
    .filter((l) => l.status === 'active' && l.nextDueDate)
    .sort((a, b) => {
      const dateA = new Date(a.nextDueDate!).getTime();
      const dateB = new Date(b.nextDueDate!).getTime();
      return dateA - dateB;
    })
    .slice(0, limit);
}

/**
 * Sorts transactions by verified date property descending and returns the latest records.
 */
export function getLatestTransactions(
  transactions: Transaction[],
  limit: number = 5
): Transaction[] {
  return [...transactions]
    .sort((a, b) => {
      const dateA = getTransactionDate(a).getTime();
      const dateB = getTransactionDate(b).getTime();
      return dateB - dateA;
    })
    .slice(0, limit);
}
