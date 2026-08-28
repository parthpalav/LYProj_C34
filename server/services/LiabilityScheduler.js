import crypto from 'crypto';
import mongoose from 'mongoose';
import Liability from '../models/Liability.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { calculateNextDueDate } from '../controllers/liabilityController.js';
import { logger } from '../utils/logger.js';

let schedulerInterval = null;

// The amount of time in ms between periodic checks
export const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour

// Stale claim threshold: after 10 minutes, a dead/crashed worker's claim can be recovered
export const STALE_CLAIM_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// Bound the size of processed liability occurrences on User document
export const MAX_USER_OCCURRENCE_HISTORY = 200;

function userFilter(userId) {
  const conditions = [{ id: String(userId) }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  return { $or: conditions };
}

async function releaseClaim(liabilityId, scheduledFor, processingToken) {
  try {
    await Liability.findOneAndUpdate(
      {
        id: liabilityId,
        nextDueDate: scheduledFor,
        processingToken: processingToken
      },
      {
        $unset: {
          processingScheduledFor: 1,
          processingStartedAt: 1,
          processingToken: 1
        }
      }
    );
  } catch (e) {
    logger.error(`Failed to release claim for liability ${liabilityId}:`, e);
  }
}

export async function processSingleLiability(liability, now = new Date(), staleThreshold = null) {
  const scheduledFor = liability.nextDueDate;
  if (!scheduledFor) return;

  const threshold = staleThreshold || new Date(now.getTime() - STALE_CLAIM_THRESHOLD_MS);
  const processingToken = crypto.randomUUID();
  const occurrenceKey = `${liability.id}:${new Date(scheduledFor).toISOString()}`;

  // Step 1: Verify User exists BEFORE acquiring claim or creating transaction
  const user = await User.findOne(userFilter(liability.userId));
  if (!user) {
    logger.error(`LiabilityScheduler: User ${liability.userId} not found for liability ${liability.id}. Skipping.`);
    return;
  }

  // Step 2: Atomic Occurrence Claim
  // Match either fresh claim (processingScheduledFor null/absent)
  // OR stale claim where processingStartedAt <= staleThreshold AND processingScheduledFor == scheduledFor
  const claimed = await Liability.findOneAndUpdate(
    {
      id: liability.id,
      nextDueDate: scheduledFor,
      status: 'active',
      autoDeduct: true,
      $or: [
        { processingScheduledFor: null },
        { processingScheduledFor: { $exists: false } },
        {
          processingScheduledFor: scheduledFor,
          processingStartedAt: { $lte: threshold }
        }
      ]
    },
    {
      $set: {
        processingScheduledFor: scheduledFor,
        processingStartedAt: now,
        processingToken: processingToken
      }
    },
    { new: true }
  );

  if (!claimed) {
    // Another worker actively claimed or processed this occurrence
    return;
  }

  try {
    // Step 3: Inspect existing state to determine State A, B, C, or D
    let tx = await Transaction.findOne({
      liabilityId: liability.id,
      scheduledFor: scheduledFor
    });

    const userFresh = await User.findOne(userFilter(liability.userId)).lean();
    const hasMarker = Array.isArray(userFresh?.processedLiabilityOccurrences) &&
      userFresh.processedLiabilityOccurrences.includes(occurrenceKey);

    // State A: No transaction, no occurrence marker
    // State B: Transaction exists, occurrence marker absent
    // State C: Transaction exists, occurrence marker present
    // State D: No transaction, occurrence marker present

    // Step 3A: Ensure Transaction exists
    if (!tx) {
      if (hasMarker) {
        logger.warn(`LiabilityScheduler: State D detected (marker present, tx absent) for ${occurrenceKey}. Recreating transaction.`);
      }
      try {
        const newTx = new Transaction({
          id: crypto.randomUUID(),
          userId: String(liability.userId),
          amount: liability.amount,
          category: liability.category,
          type: liability.type,
          description: liability.name,
          timestamp: scheduledFor,
          classificationSource: 'liability',
          needsReview: false,
          liabilityId: liability.id,
          scheduledFor: scheduledFor
        });
        await newTx.save();
        tx = newTx;
        logger.info(`Generated auto-deduct transaction for liability ${liability.id} (${liability.name}) scheduled for ${scheduledFor}`);
      } catch (txErr) {
        if (txErr.code === 11000) {
          // Unexpected duplicate: fetch the existing transaction
          tx = await Transaction.findOne({ liabilityId: liability.id, scheduledFor: scheduledFor });
        } else {
          logger.error(`LiabilityScheduler: Transaction creation failed for ${occurrenceKey}:`, txErr);
          await releaseClaim(liability.id, scheduledFor, processingToken);
          return;
        }
      }
    }

    // Step 3B: Ensure Balance is debited atomically with occurrence marker on User document
    if (!hasMarker) {
      const userUpdate = await User.findOneAndUpdate(
        {
          ...userFilter(liability.userId),
          processedLiabilityOccurrences: { $ne: occurrenceKey }
        },
        {
          $inc: { currentBalance: -liability.amount },
          $push: {
            processedLiabilityOccurrences: {
              $each: [occurrenceKey],
              $slice: -MAX_USER_OCCURRENCE_HISTORY
            }
          }
        },
        { new: true }
      );

      if (!userUpdate) {
        // Double-check if marker was added concurrently
        const recheckUser = await User.findOne(userFilter(liability.userId)).lean();
        const recheckMarker = Array.isArray(recheckUser?.processedLiabilityOccurrences) &&
          recheckUser.processedLiabilityOccurrences.includes(occurrenceKey);

        if (!recheckMarker) {
          logger.error(`LiabilityScheduler: Balance debit failed for user ${liability.userId}, occurrence ${occurrenceKey}. Releasing claim for retry.`);
          await releaseClaim(liability.id, scheduledFor, processingToken);
          return;
        }
      }
    }

    // Step 4: Finalize the Liability (Advance nextDueDate and clear processing state)
    // Only workers holding the current processingToken may finalize!
    // Derive nextDate from scheduledFor (the occurrence being processed) to preserve recurrence cadence
    const nextDate = calculateNextDueDate(liability, scheduledFor);
    const finalized = await Liability.findOneAndUpdate(
      {
        id: liability.id,
        nextDueDate: scheduledFor,
        processingToken: processingToken
      },
      {
        $set: {
          nextDueDate: nextDate
        },
        $unset: {
          processingScheduledFor: 1,
          processingStartedAt: 1,
          processingToken: 1
        }
      },
      { new: true }
    );

    if (finalized) {
      logger.info(`Auto-deducted liability ${liability.id} (${liability.name}): ₹${liability.amount} processed, next due date advanced to ${nextDate}`);
    }
  } catch (procErr) {
    logger.error(`LiabilityScheduler: Unexpected error processing ${occurrenceKey}:`, procErr);
  }
}

export async function processLiabilities() {
  try {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_CLAIM_THRESHOLD_MS);

    // Find all active, autoDeduct liabilities where nextDueDate <= now
    // and either unclaimed (processingScheduledFor null/missing) or stale (processingStartedAt <= staleThreshold)
    const dueLiabilities = await Liability.find({
      status: 'active',
      autoDeduct: true,
      nextDueDate: { $lte: now },
      $or: [
        { processingScheduledFor: null },
        { processingScheduledFor: { $exists: false } },
        { processingStartedAt: { $lte: staleThreshold } }
      ]
    });

    for (const liability of dueLiabilities) {
      await processSingleLiability(liability, now, staleThreshold);
    }
  } catch (err) {
    logger.error('Error in LiabilityScheduler poll:', err);
  }
}

export function startScheduler() {
  if (schedulerInterval) return;

  // Run immediately on start, then periodically
  processLiabilities();

  schedulerInterval = setInterval(() => {
    processLiabilities();
  }, POLL_INTERVAL);

  logger.info(`Liability scheduler started. Polling every ${POLL_INTERVAL / 1000 / 60} minutes.`);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Liability scheduler stopped.');
  }
}
