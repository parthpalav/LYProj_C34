import crypto from 'node:crypto';
import Asset from '../models/Asset.js';
import { logger } from '../utils/logger.js';
import { fixedIncomeSnapshot, isFixedIncomeType } from '../utils/fixedIncome.js';
import { refreshFixedIncomeValues } from '../services/AssetValuationService.js';

const VALID_ASSET_CLASSES = ['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE'];
const VALID_LIQUIDITIES = ['liquid', 'locked', 'restricted'];

function userFilter(userId) {
  return { userId: String(userId) };
}

const MAX_TENURE_MONTHS = 600;

/** Validates the optional SIP / FD / RD fields present in `body`. Returns { fields } or { error, code }. */
function parsePlanFields(body, now = new Date()) {
  const fields = {};
  const blank = (v) => v === null || v === '';
  const { monthlyContribution, principal, tenureMonths, startDate } = body;

  if (monthlyContribution !== undefined) {
    const v = blank(monthlyContribution) ? null : Number(monthlyContribution);
    if (v !== null && !(Number.isFinite(v) && v >= 0)) {
      return { error: 'Monthly SIP / installment must be a non-negative number', code: 'INVALID_MONTHLY_CONTRIBUTION' };
    }
    fields.monthlyContribution = v;
  }
  if (principal !== undefined) {
    const v = blank(principal) ? null : Number(principal);
    if (v !== null && !(Number.isFinite(v) && v > 0)) {
      return { error: 'Deposit amount must be greater than 0', code: 'INVALID_PRINCIPAL' };
    }
    fields.principal = v;
  }
  if (tenureMonths !== undefined) {
    const v = blank(tenureMonths) ? null : Number(tenureMonths);
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= MAX_TENURE_MONTHS)) {
      return { error: `Tenure must be a whole number of months between 1 and ${MAX_TENURE_MONTHS}`, code: 'INVALID_TENURE' };
    }
    fields.tenureMonths = v;
  }
  if (startDate !== undefined) {
    const v = blank(startDate) ? null : new Date(startDate);
    if (v !== null && (isNaN(v.getTime()) || v > now)) {
      return { error: 'Start date must be a valid date that is not in the future', code: 'INVALID_START_DATE' };
    }
    fields.startDate = v;
  }
  return { fields };
}

/**
 * FD/RD: compute currentValue from rate, start date and tenure. Other types drop the deposit-only fields.
 * Returns an error object when an FD/RD was given some deposit details but not enough to value it.
 */
function applyFixedIncome(asset, now = new Date()) {
  if (!isFixedIncomeType(asset.assetType)) {
    asset.principal = null;
    asset.startDate = null;
    asset.tenureMonths = null;
    return null;
  }
  const snap = fixedIncomeSnapshot(asset, now);
  if (snap) {
    asset.currentValue = snap.currentValue;
    return null;
  }
  const isRD = asset.assetType === 'Recurring Deposit';
  const touched = asset.principal != null || asset.startDate != null || asset.tenureMonths != null
    || (isRD && asset.monthlyContribution != null);
  if (!touched) return null; // legacy FD/RD with a manual value only
  return {
    error: `${asset.assetType} needs ${isRD ? 'a monthly installment' : 'a deposit amount'}, interest rate, start date and tenure`,
    code: 'INCOMPLETE_FIXED_INCOME'
  };
}

/** API shape: the stored asset plus maturity details for a complete FD/RD. */
function serialize(asset, now = new Date()) {
  const obj = typeof asset.toObject === 'function' ? asset.toObject() : asset;
  const snap = fixedIncomeSnapshot(obj, now);
  if (!snap) return obj;
  return { ...obj, currentValue: snap.currentValue, maturityValue: snap.maturityValue, maturityDate: snap.maturityDate, matured: snap.matured };
}

/**
 * GET /api/assets
 * Lists all assets for the authenticated user.
 */
export const getAssets = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    await refreshFixedIncomeValues(userFilter(userId));
    const assets = await Asset.find(userFilter(userId)).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: assets.map((a) => serialize(a)) });
  } catch (error) {
    logger.error('[assetController] Error fetching assets:', error);
    next(error);
  }
};

/**
 * POST /api/assets
 * Creates a new financial asset for the authenticated user.
 */
export const createAsset = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      name,
      assetType,
      assetClass,
      currentValue,
      annualReturnRate,
      includedInFireCorpus,
      liquidity,
      notes
    } = req.body;
    const now = new Date();

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Asset name is required',
        code: 'INVALID_ASSET_NAME'
      });
    }

    if (!assetType || typeof assetType !== 'string' || !assetType.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Asset type is required',
        code: 'INVALID_ASSET_TYPE'
      });
    }

    if (!VALID_ASSET_CLASSES.includes(assetClass)) {
      return res.status(400).json({
        success: false,
        error: `Asset class must be one of: ${VALID_ASSET_CLASSES.join(', ')}`,
        code: 'INVALID_ASSET_CLASS'
      });
    }

    const plan = parsePlanFields(req.body, now);
    if (plan.error) {
      return res.status(400).json({ success: false, error: plan.error, code: plan.code });
    }

    // A complete FD/RD gets its value computed below, so currentValue may be omitted.
    const computed = isFixedIncomeType(assetType.trim()) && (currentValue === undefined || currentValue === null || currentValue === '');
    const numValue = computed ? 0 : Number(currentValue);
    if (!Number.isFinite(numValue) || numValue < 0) {
      return res.status(400).json({
        success: false,
        error: 'Current value must be a non-negative number',
        code: 'INVALID_CURRENT_VALUE'
      });
    }

    let cleanAnnualReturnRate = null;
    if (annualReturnRate !== undefined && annualReturnRate !== null && annualReturnRate !== '') {
      const numRate = Number(annualReturnRate);
      if (!Number.isFinite(numRate) || numRate < 0 || numRate > 100) {
        return res.status(400).json({
          success: false,
          error: 'Annual return rate must be a finite number between 0% and 100%',
          code: 'INVALID_ANNUAL_RETURN_RATE'
        });
      }
      cleanAnnualReturnRate = numRate > 1 ? numRate / 100 : numRate;
    }

    const isIncludedInFire = Boolean(includedInFireCorpus);
    if (assetClass === 'NON_INVESTABLE' && isIncludedInFire) {
      return res.status(400).json({
        success: false,
        error: 'Non-investable assets cannot be included in the FIRE corpus',
        code: 'NON_INVESTABLE_FIRE_CONFLICT'
      });
    }

    const cleanLiquidity = (liquidity && VALID_LIQUIDITIES.includes(liquidity))
      ? liquidity
      : (isFixedIncomeType(assetType) ? 'locked' : 'liquid'); // deposits can't be spent until maturity

    const assetId = crypto.randomUUID();

    const newAsset = new Asset({
      id: assetId,
      userId: String(userId),
      name: name.trim(),
      assetType: assetType.trim(),
      assetClass,
      currentValue: numValue,
      annualReturnRate: cleanAnnualReturnRate,
      includedInFireCorpus: isIncludedInFire,
      liquidity: cleanLiquidity,
      notes: typeof notes === 'string' ? notes.trim() : '',
      ...plan.fields,
      lastReviewedAt: now
    });

    const fixedError = applyFixedIncome(newAsset, now);
    if (fixedError || (computed && !fixedIncomeSnapshot(newAsset, now))) {
      return res.status(400).json({
        success: false,
        error: fixedError?.error || 'Current value must be a non-negative number',
        code: fixedError?.code || 'INVALID_CURRENT_VALUE'
      });
    }

    await newAsset.save();

    res.status(201).json({
      success: true,
      data: serialize(newAsset, now)
    });
  } catch (error) {
    logger.error('[assetController] Error creating asset:', error);
    next(error);
  }
};

/**
 * PUT /api/assets/:id
 * Updates an existing asset owned by the authenticated user.
 */
export const updateAsset = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const {
      name,
      assetType,
      assetClass,
      currentValue,
      annualReturnRate,
      includedInFireCorpus,
      liquidity,
      notes
    } = req.body;

    const now = new Date();
    const existing = await Asset.findOne({ id, ...userFilter(userId) });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
        code: 'ASSET_NOT_FOUND'
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Asset name cannot be empty',
          code: 'INVALID_ASSET_NAME'
        });
      }
      existing.name = name.trim();
    }

    if (assetType !== undefined) {
      if (typeof assetType !== 'string' || !assetType.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Asset type cannot be empty',
          code: 'INVALID_ASSET_TYPE'
        });
      }
      existing.assetType = assetType.trim();
    }

    if (assetClass !== undefined) {
      if (!VALID_ASSET_CLASSES.includes(assetClass)) {
        return res.status(400).json({
          success: false,
          error: `Asset class must be one of: ${VALID_ASSET_CLASSES.join(', ')}`,
          code: 'INVALID_ASSET_CLASS'
        });
      }
      existing.assetClass = assetClass;
    }

    if (currentValue !== undefined) {
      const numValue = Number(currentValue);
      if (!Number.isFinite(numValue) || numValue < 0) {
        return res.status(400).json({
          success: false,
          error: 'Current value must be a non-negative number',
          code: 'INVALID_CURRENT_VALUE'
        });
      }
      existing.currentValue = numValue;
    }

    if (annualReturnRate !== undefined) {
      if (annualReturnRate === null || annualReturnRate === '') {
        existing.annualReturnRate = null;
      } else {
        const numRate = Number(annualReturnRate);
        if (!Number.isFinite(numRate) || numRate < 0 || numRate > 100) {
          return res.status(400).json({
            success: false,
            error: 'Annual return rate must be a finite number between 0% and 100%',
            code: 'INVALID_ANNUAL_RETURN_RATE'
          });
        }
        existing.annualReturnRate = numRate > 1 ? numRate / 100 : numRate;
      }
    }

    if (includedInFireCorpus !== undefined) {
      existing.includedInFireCorpus = Boolean(includedInFireCorpus);
    }

    // Safeguard rule: NON_INVESTABLE cannot count toward FIRE
    if (existing.assetClass === 'NON_INVESTABLE' && existing.includedInFireCorpus) {
      return res.status(400).json({
        success: false,
        error: 'Non-investable assets cannot be included in the FIRE corpus',
        code: 'NON_INVESTABLE_FIRE_CONFLICT'
      });
    }

    if (liquidity !== undefined) {
      if (!VALID_LIQUIDITIES.includes(liquidity)) {
        return res.status(400).json({
          success: false,
          error: `Liquidity must be one of: ${VALID_LIQUIDITIES.join(', ')}`,
          code: 'INVALID_LIQUIDITY'
        });
      }
      existing.liquidity = liquidity;
    }

    if (notes !== undefined) {
      existing.notes = typeof notes === 'string' ? notes.trim() : '';
    }

    const plan = parsePlanFields(req.body, now);
    if (plan.error) {
      return res.status(400).json({ success: false, error: plan.error, code: plan.code });
    }
    existing.set(plan.fields);

    const fixedError = applyFixedIncome(existing, now);
    if (fixedError) {
      return res.status(400).json({ success: false, ...fixedError });
    }

    // Confirming value or return counts as this month's review.
    if (currentValue !== undefined || annualReturnRate !== undefined) {
      existing.lastReviewedAt = now;
    }

    await existing.save();

    res.json({
      success: true,
      data: serialize(existing, now)
    });
  } catch (error) {
    logger.error('[assetController] Error updating asset:', error);
    next(error);
  }
};

/**
 * DELETE /api/assets/:id
 * Deletes an asset owned by the authenticated user.
 */
export const deleteAsset = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const deleted = await Asset.findOneAndDelete({ id, ...userFilter(userId) });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
        code: 'ASSET_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    logger.error('[assetController] Error deleting asset:', error);
    next(error);
  }
};
