// Credit card billing-cycle math on UTC calendar fields. Callers pass dates already
// shifted to the user's timezone (utils/userTime.js toZoned) and unshift the results.
//
// A statement covers purchases up to the end of `statementDay`. The bill for that
// statement is due on the next `dueDay` after it. Payments are applied to billed
// amounts first, so: amount due = outstanding - purchases since the last statement.

const DAY_MS = 24 * 60 * 60 * 1000;

function clampedDate(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// Exclusive end of the statement period that closes in (year, month).
function statementCloseIn(year, month, statementDay) {
  return new Date(clampedDate(year, month, statementDay).getTime() + DAY_MS);
}

// Statement closes (exclusive end instants) at or before `now`: [latest, previous].
export function recentStatementCloses(statementDay, now = new Date()) {
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let close = statementCloseIn(y, m, statementDay);
  if (close > now) {
    m -= 1;
    close = statementCloseIn(y, m, statementDay);
  }
  const previous = statementCloseIn(y, m - 1, statementDay);
  return [close, previous];
}

export function nextStatementClose(statementDay, now = new Date()) {
  const [latest] = recentStatementCloses(statementDay, now);
  const statementDate = new Date(latest.getTime() - DAY_MS);
  return statementCloseIn(statementDate.getUTCFullYear(), statementDate.getUTCMonth() + 1, statementDay);
}

// Due date for the statement whose period ended just before `close`.
export function dueDateForClose(close, dueDay) {
  const statementDate = new Date(close.getTime() - DAY_MS);
  const y = statementDate.getUTCFullYear();
  const m = statementDate.getUTCMonth();
  const sameMonth = clampedDate(y, m, dueDay);
  return sameMonth > statementDate ? sameMonth : clampedDate(y, m + 1, dueDay);
}

/**
 * @param {object} card    PaymentMethod with creditLimit, outstanding, statementDay, dueDay
 * @param {Array<{amount:number,timestamp:Date}>} recentCharges  card purchases since the previous statement close
 */
export function creditCardSummary(card, recentCharges, now = new Date()) {
  const [lastClose, prevClose] = recentStatementCloses(card.statementDay, now);
  const sumSince = (from) => recentCharges
    .filter((c) => new Date(c.timestamp) >= from)
    .reduce((s, c) => s + c.amount, 0);

  const outstanding = round2(card.outstanding || 0);
  const unbilled = round2(sumSince(lastClose));
  const amountDue = round2(Math.max(0, outstanding - unbilled));
  const lastDue = dueDateForClose(lastClose, card.dueDay);

  // Overdue: whatever was billed on the latest statement whose due day has fully ended.
  const duePassed = (due) => due.getTime() + DAY_MS <= now.getTime();
  const passedClose = duePassed(lastDue) ? lastClose : prevClose;
  const overdueAmount = duePassed(dueDateForClose(passedClose, card.dueDay))
    ? round2(Math.max(0, outstanding - sumSince(passedClose)))
    : 0;

  const nextClose = nextStatementClose(card.statementDay, now);

  return {
    creditLimit: card.creditLimit,
    outstanding,
    available: round2(card.creditLimit - outstanding),
    unbilled,
    amountDue,
    overdueAmount,
    lastStatementDate: new Date(lastClose.getTime() - DAY_MS),
    dueDate: amountDue > 0 ? lastDue : dueDateForClose(nextClose, card.dueDay),
    nextStatementDate: new Date(nextClose.getTime() - DAY_MS)
  };
}

/**
 * Synthetic charges that make the cycle sums match a balance the user reports:
 * `billedUnpaid` sits on the latest statement and the rest of `used` is unbilled.
 * Amounts can be negative when tracked purchases already exceed what was reported.
 * @param {Array<{amount:number,timestamp:Date}>} recentCharges  tracked card purchases since the previous statement close
 */
export function balanceAdjustments(statementDay, used, billedUnpaid, recentCharges, now = new Date()) {
  const [lastClose, prevClose] = recentStatementCloses(statementDay, now);
  const sumBetween = (from, to) => recentCharges
    .filter((c) => { const t = new Date(c.timestamp); return t >= from && t < to; })
    .reduce((s, c) => s + c.amount, 0);
  return [
    { amount: round2(billedUnpaid - sumBetween(prevClose, lastClose)), timestamp: new Date(lastClose.getTime() - 1) },
    { amount: round2(used - billedUnpaid - sumBetween(lastClose, Infinity)), timestamp: now }
  ].filter((a) => a.amount !== 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
