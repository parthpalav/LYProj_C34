import Asset from '../models/Asset.js';
import { FIXED_INCOME_TYPES, fixedIncomeSnapshot } from '../utils/fixedIncome.js';

/** Persist the accrued value of every complete FD/RD matching `filter`, so all readers of Asset see it. */
export async function refreshFixedIncomeValues(filter = {}, now = new Date()) {
  const assets = await Asset.find({ ...filter, assetType: { $in: FIXED_INCOME_TYPES }, tenureMonths: { $ne: null } }).lean();
  const ops = [];
  for (const a of assets) {
    const snap = fixedIncomeSnapshot(a, now);
    if (snap && snap.currentValue !== a.currentValue) {
      ops.push({ updateOne: { filter: { id: a.id }, update: { $set: { currentValue: snap.currentValue } } } });
    }
  }
  if (ops.length) await Asset.bulkWrite(ops);
  return ops.length;
}
