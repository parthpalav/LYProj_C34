import Asset from '../models/Asset.js';
import Transaction from '../models/Transaction.js';
import { zonedDateKey, zonedMonthStart } from '../utils/userTime.js';

const normalize = (text) => String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// A forecast reads the existing ledger. Reading or retrying it never posts a debit.
export function buildSipSchedule(assets, transactions, now, tz) {
  const today = zonedDateKey(now, tz);
  const month = today.slice(0, 7);
  const lastDay = zonedDateKey(new Date(zonedMonthStart(now, tz, 1) - 1), tz).slice(8);
  const items = [];
  const claims = new Map();
  for (const asset of assets) {
    if (!asset.sipFirstDue || !(asset.monthlyContribution > 0)) continue;
    const day = Math.min(Number(lastDay), Number(asset.sipFirstDue.slice(8)));
    const monthlyDue = month + '-' + String(day).padStart(2, '0');
    const dueDate = asset.sipFirstDue > monthlyDue ? asset.sipFirstDue : monthlyDue;
    const payee = normalize(asset.sipPayee || asset.name);
    const candidates = dueDate <= today && payee ? transactions.filter((tx) =>
      tx.type === 'Investment' && tx.amount === asset.monthlyContribution &&
      zonedDateKey(tx.timestamp, tz) === dueDate &&
      (' ' + normalize(tx.description) + ' ').includes(' ' + payee + ' ')
    ) : [];
    for (const tx of candidates) claims.set(tx.id, (claims.get(tx.id) || 0) + 1);
    items.push({ id: asset.id, name: asset.name, amount: asset.monthlyContribution, dueDate, candidates });
  }
  let remaining = 0;
  const schedule = items.map(({ candidates, ...item }) => {
    let status = item.dueDate <= today ? 'Awaiting debit' : 'Scheduled';
    if (candidates.length) {
      status = candidates.length === 1 && claims.get(candidates[0].id) === 1 ? 'Recorded' : 'Check matches';
    }
    if (status !== 'Recorded' && item.dueDate.startsWith(month)) remaining += item.amount;
    return { ...item, status };
  });
  return { items: schedule.sort((a, b) => a.dueDate.localeCompare(b.dueDate)), remaining };
}

export async function getSipSchedule(userId, now, tz) {
  const assets = await Asset.find({ userId, sipFirstDue: { $type: 'string' }, monthlyContribution: { $gt: 0 } })
    .select('id name monthlyContribution sipFirstDue sipPayee').lean();
  const transactions = assets.length ? await Transaction.find({
    userId, type: 'Investment', amount: { $in: assets.map(a => a.monthlyContribution) },
    timestamp: { $gte: zonedMonthStart(now, tz), $lt: zonedMonthStart(now, tz, 1) },
  }).select('id type amount description timestamp').lean() : [];
  return buildSipSchedule(assets, transactions, now, tz);
}
