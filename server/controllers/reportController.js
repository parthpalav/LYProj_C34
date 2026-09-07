import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import FMIHistory from '../models/FMIHistory.js';

/**
 * GET /api/reports/monthly
 * Generates an authoritative, read-only, user-isolated monthly report.
 * Query params:
 *  - year: number (e.g. 2026)
 *  - month: number (1 to 12)
 *  - period: string (e.g. "2026-08")
 */
export async function getMonthlyReport(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    let year;
    let month;

    if (req.query.year !== undefined) {
      year = Number(req.query.year);
    }
    if (req.query.month !== undefined) {
      month = Number(req.query.month);
    }

    // Optional period parameter fallback ("YYYY-MM")
    if ((year === undefined || month === undefined) && typeof req.query.period === 'string') {
      const parts = req.query.period.trim().split('-');
      if (parts.length === 2) {
        year = Number(parts[0]);
        month = Number(parts[1]);
      }
    }

    // Default to current calendar month (UTC) if omitted
    const now = new Date();
    if (year === undefined) {
      year = now.getUTCFullYear();
    }
    if (month === undefined) {
      month = now.getUTCMonth() + 1; // 1-indexed
    }

    // Strict validation
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        error: 'Year must be an integer between 2000 and 2100',
        code: 'INVALID_YEAR'
      });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        error: 'Month must be an integer between 1 and 12',
        code: 'INVALID_MONTH'
      });
    }

    // Calculate deterministic UTC period bounds
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // Parallel query for stored records strictly scoped to req.user.id
    const [transactions, incomes, fmiSnapshots] = await Promise.all([
      Transaction.find({ userId, timestamp: { $gte: startDate, $lt: endDate } }).sort({ timestamp: -1 }).lean(),
      Income.find({ userId, timestamp: { $gte: startDate, $lt: endDate } }).sort({ timestamp: -1 }).lean(),
      FMIHistory.find({ userId, timestamp: { $gte: startDate, $lt: endDate } }).sort({ timestamp: 1 }).lean()
    ]);

    // Financial aggregates
    const totalIncome = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalExpenses = transactions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const incomeCount = incomes.length;
    const transactionCount = transactions.length;
    const netCashFlow = totalIncome - totalExpenses;

    // Savings rate safely handling zero-income months
    const savingsRate = totalIncome > 0
      ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
      : 0;

    // Spending mix (Needs, Wants, Investments)
    const spendingMix = {
      Needs: 0,
      Wants: 0,
      Investments: 0
    };

    const categoryMap = {};
    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      const tType = tx.type || 'Need';
      if (tType === 'Want') spendingMix.Wants += amt;
      else if (tType === 'Investment') spendingMix.Investments += amt;
      else spendingMix.Needs += amt;

      const cat = tx.category || 'Misc';
      categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    }

    // Top categories ranked by spend
    const topCategories = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
        pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // FMI snapshot analysis
    const hasSnapshots = fmiSnapshots.length > 0;
    const snapshotCount = fmiSnapshots.length;
    let fmiAverage = null;
    let fmiFirst = null;
    let fmiLast = null;
    let fmiChange = null;

    if (hasSnapshots) {
      const sumScores = fmiSnapshots.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
      fmiAverage = Math.round(sumScores / snapshotCount);
      fmiFirst = fmiSnapshots[0].score;
      fmiLast = fmiSnapshots[snapshotCount - 1].score;
      if (snapshotCount >= 2) {
        fmiChange = fmiLast - fmiFirst;
      }
    }

    // Anomalies
    const anomalyTxs = transactions.filter((t) => Boolean(t.isAnomaly));
    const anomalies = {
      count: anomalyTxs.length,
      items: anomalyTxs.map((t) => ({
        id: t.id,
        description: t.description || '',
        amount: t.amount,
        category: t.category || 'Misc',
        timestamp: t.timestamp
      }))
    };

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const periodLabel = `${monthNames[month - 1]} ${year}`;
    const periodString = `${year}-${String(month).padStart(2, '0')}`;

    const report = {
      year,
      month,
      period: periodString,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalIncome: Math.round(totalIncome),
      incomeCount,
      totalExpenses: Math.round(totalExpenses),
      transactionCount,
      netCashFlow: Math.round(netCashFlow),
      savingsRate,
      spendingMix: {
        Needs: Math.round(spendingMix.Needs),
        Wants: Math.round(spendingMix.Wants),
        Investments: Math.round(spendingMix.Investments)
      },
      topCategories,
      fmi: {
        hasSnapshots,
        snapshotCount,
        average: fmiAverage,
        first: fmiFirst,
        last: fmiLast,
        change: fmiChange
      },
      anomalies
    };

    return res.json({
      success: true,
      data: report,
      ...report
    });
  } catch (error) {
    next(error);
  }
}
