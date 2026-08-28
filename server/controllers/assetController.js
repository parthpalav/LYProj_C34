import crypto from 'node:crypto';
import Asset from '../models/Asset.js';
import { logger } from '../utils/logger.js';

const VALID_ASSET_CLASSES = ['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE'];
const VALID_LIQUIDITIES = ['liquid', 'locked', 'restricted'];

function userFilter(userId) {
  return { userId: String(userId) };
}

/**
 * GET /api/assets
 * Lists all assets for the authenticated user.
 */
export const getAssets = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const assets = await Asset.find(userFilter(userId)).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: assets });
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

    const numValue = Number(currentValue);
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
      : 'liquid';

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
      notes: typeof notes === 'string' ? notes.trim() : ''
    });

    await newAsset.save();

    res.status(201).json({
      success: true,
      data: newAsset
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

    await existing.save();

    res.json({
      success: true,
      data: existing
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
