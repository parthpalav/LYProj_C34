import mongoose from 'mongoose';
import User from '../models/User.js';
import Income from '../models/Income.js';
import Transaction from '../models/Transaction.js';
import Asset from '../models/Asset.js';
import Liability from '../models/Liability.js';
import {
  getPredictabilitySnapshot,
  buildPredictabilitySnapshot
} from '../services/PredictabilityService.js';
import { resolveForecastInputs } from '../utils/forecastResolver.js';
import { attachMonteCarloSimulation } from '../utils/monteCarloAdapter.js';
import {
  MAX_ANNUAL_CONTRIBUTION_GROWTH_RATE,
  CONTRIBUTION_MODE
} from '../config/financialRules.js';
import { logger } from '../utils/logger.js';

const ALLOWED_SCENARIO_KEYS = Object.freeze([
  'monthlyContribution',
  'retirementAge',
  'expectedReturnRate',
  'expectedInflationRate',
  'annualContributionGrowthRate',
  'contributionMode'
]);

const VALID_CONTRIBUTION_MODES = Object.freeze([
  CONTRIBUTION_MODE.NOMINAL_FLAT,
  CONTRIBUTION_MODE.REAL_CONSTANT,
  CONTRIBUTION_MODE.STEP_UP
]);

/**
 * GET /api/predictability
 * Returns deterministic predictability snapshot for the authenticated user.
 */
export const getPredictability = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User identity not found in token context.',
        code: 'UNAUTHENTICATED'
      });
    }

    const options = {};
    if (req.query.contributionMode) {
      options.contributionMode = String(req.query.contributionMode).toUpperCase();
    }
    if (req.query.annualContributionGrowthRate !== undefined && req.query.annualContributionGrowthRate !== '') {
      const g = Number(req.query.annualContributionGrowthRate);
      if (Number.isFinite(g)) {
        options.annualContributionGrowthRate = g;
      }
    }

    const snapshot = await getPredictabilitySnapshot(userId, options);

    return res.status(200).json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    if (error.message && error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
    }

    logger.error('Error in getPredictability controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating predictability snapshot',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * POST /api/predictability/scenario
 * Evaluates an in-memory financial scenario with temporary parameter overrides.
 *
 * Invariants:
 *  - Authenticated via JWT, strictly isolated by req.user.id
 *  - Rejects unknown or unsupported keys (HTTP 400 UNKNOWN_SCENARIO_FIELD)
 *  - Validates input bounds against backend constraints
 *  - Read-only: ZERO database mutations / persistence
 *  - Empty override payload produces exact baseline parity with GET /api/predictability
 */
export const evaluateScenario = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User identity not found in token context.',
        code: 'UNAUTHENTICATED'
      });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        error: 'Scenario payload must be a JSON object',
        code: 'INVALID_SCENARIO_PAYLOAD'
      });
    }

    // 1. Strict key validation (Correction #10)
    for (const key of Object.keys(body)) {
      if (!ALLOWED_SCENARIO_KEYS.includes(key)) {
        return res.status(400).json({
          success: false,
          error: `Unknown or unsupported scenario override field: '${key}'`,
          code: 'UNKNOWN_SCENARIO_FIELD'
        });
      }
    }

    // 2. Resolve User Document (read-only)
    const conditions = [{ id: userId }];
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conditions.push({ _id: userId });
    }
    const user = await User.findOne({ $or: conditions }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Determine current user age for timeline constraint checks
    let currentAge = null;
    if (user.age !== null && user.age !== undefined && Number.isFinite(Number(user.age))) {
      currentAge = Number(user.age);
    } else if (user.dateOfBirth) {
      const dob = new Date(user.dateOfBirth);
      if (!isNaN(dob.getTime())) {
        const ageDiff = Date.now() - dob.getTime();
        currentAge = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
      }
    }

    // 3. Field-specific bounds validation (Correction #5)
    const {
      monthlyContribution,
      retirementAge,
      expectedReturnRate,
      expectedInflationRate,
      annualContributionGrowthRate,
      contributionMode
    } = body;

    if (monthlyContribution !== undefined) {
      const num = Number(monthlyContribution);
      if (!Number.isFinite(num) || num < 0) {
        return res.status(400).json({
          success: false,
          error: 'monthlyContribution must be a finite, non-negative number',
          code: 'INVALID_MONTHLY_CONTRIBUTION'
        });
      }
    }

    if (retirementAge !== undefined) {
      const num = Number(retirementAge);
      if (!Number.isInteger(num) || num < 40 || num > 100) {
        return res.status(400).json({
          success: false,
          error: 'retirementAge must be an integer between 40 and 100',
          code: 'INVALID_RETIREMENT_AGE'
        });
      }
      if (currentAge !== null && num <= currentAge) {
        return res.status(400).json({
          success: false,
          error: `retirementAge (${num}) must be greater than current age (${currentAge})`,
          code: 'RETIREMENT_AGE_BELOW_CURRENT_AGE'
        });
      }
    }

    if (expectedReturnRate !== undefined) {
      const num = Number(expectedReturnRate);
      if (!Number.isFinite(num) || num < 0 || num > 1) {
        return res.status(400).json({
          success: false,
          error: 'expectedReturnRate must be a decimal fraction between 0.0 and 1.0',
          code: 'INVALID_EXPECTED_RETURN_RATE'
        });
      }
    }

    if (expectedInflationRate !== undefined) {
      const num = Number(expectedInflationRate);
      if (!Number.isFinite(num) || num < 0 || num > 1) {
        return res.status(400).json({
          success: false,
          error: 'expectedInflationRate must be a decimal fraction between 0.0 and 1.0',
          code: 'INVALID_EXPECTED_INFLATION_RATE'
        });
      }
    }

    if (annualContributionGrowthRate !== undefined) {
      const num = Number(annualContributionGrowthRate);
      if (!Number.isFinite(num) || num < 0 || num > MAX_ANNUAL_CONTRIBUTION_GROWTH_RATE) {
        return res.status(400).json({
          success: false,
          error: `annualContributionGrowthRate must be a decimal fraction between 0.0 and ${MAX_ANNUAL_CONTRIBUTION_GROWTH_RATE}`,
          code: 'INVALID_ANNUAL_CONTRIBUTION_GROWTH_RATE'
        });
      }
    }

    if (contributionMode !== undefined) {
      const modeStr = String(contributionMode).toUpperCase();
      if (!VALID_CONTRIBUTION_MODES.includes(modeStr)) {
        return res.status(400).json({
          success: false,
          error: `contributionMode must be one of: ${VALID_CONTRIBUTION_MODES.join(', ')}`,
          code: 'INVALID_CONTRIBUTION_MODE'
        });
      }
    }

    // 4. Fetch user's financial documents (read-only)
    const queryUid = user.id || userId;
    const [incomes, transactions, assets, liabilities] = await Promise.all([
      Income.find({ userId: queryUid }).lean(),
      Transaction.find({ userId: queryUid }).lean(),
      Asset.find({ userId: queryUid }).lean(),
      Liability.find({ userId: queryUid, status: { $ne: 'deleted' } }).lean()
    ]);

    // 5. In-Memory User Clone with Overrides (Zero DB Mutations)
    const effectiveUser = {
      ...user,
      ...(retirementAge !== undefined ? { retirementAge: Number(retirementAge) } : {}),
      ...(expectedReturnRate !== undefined ? { expectedReturnRate: Number(expectedReturnRate) } : {}),
      ...(expectedInflationRate !== undefined ? { expectedInflationRate: Number(expectedInflationRate) } : {})
    };

    const data = {
      user: effectiveUser,
      incomes,
      transactions,
      assets,
      liabilities
    };

    // 6. Build options (matching baseline defaults if undefined)
    const options = {
      skipAlternatives: true
    };

    if (monthlyContribution !== undefined) {
      options.monthlyContributionOverride = Number(monthlyContribution);
    }
    if (contributionMode !== undefined) {
      options.contributionMode = String(contributionMode).toUpperCase();
    }
    if (annualContributionGrowthRate !== undefined) {
      options.annualContributionGrowthRate = Number(annualContributionGrowthRate);
    }

    // 7. Calculate Projection Snapshot using existing tested engine
    const resolved = resolveForecastInputs(data, options);
    const snapshot = buildPredictabilitySnapshot(data, options);
    const result = await attachMonteCarloSimulation(snapshot, resolved, options);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in evaluateScenario controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while evaluating scenario',
      code: 'INTERNAL_ERROR'
    });
  }
};
