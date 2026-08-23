import crypto from 'crypto';
import mongoose from 'mongoose';
import Liability from '../models/Liability.js';
import Transaction from '../models/Transaction.js';
import { calculateNextDueDate } from '../controllers/liabilityController.js';
import { logger } from '../utils/logger.js';

let schedulerInterval = null;

// The amount of time in ms between checks
const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour

export async function processLiabilities() {
  try {
    const now = new Date();
    
    // Find all active, autoDeduct liabilities where nextDueDate <= now
    const dueLiabilities = await Liability.find({
      status: 'active',
      autoDeduct: true,
      nextDueDate: { $lte: now }
    });

    for (const liability of dueLiabilities) {
      // Safe catch-up: we don't want to create 100 transactions if server was offline for 100 months.
      // We process exactly ONE due transaction, and push the nextDueDate to the correct future date relative to NOW,
      // not relative to the old nextDueDate. This prevents a huge backlog of historic generation.
      
      const scheduledFor = liability.nextDueDate;
      const transactionId = crypto.randomUUID();

      try {
        const transaction = new Transaction({
          id: transactionId,
          userId: liability.userId,
          amount: liability.amount,
          category: liability.category,
          type: liability.type,
          description: liability.name,
          timestamp: scheduledFor, // The generated transaction takes the scheduled time
          classificationSource: 'liability',
          needsReview: false,
          liabilityId: liability.id,
          scheduledFor: scheduledFor
        });

        await transaction.save();
        logger.info(`Generated auto-deduct transaction for liability ${liability.id} (${liability.name}) scheduled for ${scheduledFor}`);

        // Update the liability's next due date (calculating from NOW, not from scheduledFor, to skip backlog)
        const nextDate = calculateNextDueDate(liability, now);
        await Liability.findOneAndUpdate(
          { id: liability.id, nextDueDate: scheduledFor },
          { $set: { nextDueDate: nextDate } }
        );
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate key error! This means a transaction with { liabilityId, scheduledFor } already exists.
          // Idempotency guarantee triggered. We treat this as "already processed" and advance the date.
          logger.warn(`Idempotency caught duplicate transaction for liability ${liability.id} at ${scheduledFor}. Advancing nextDueDate.`);
          const nextDate = calculateNextDueDate(liability, now);
          await Liability.findOneAndUpdate(
            { id: liability.id, nextDueDate: scheduledFor },
            { $set: { nextDueDate: nextDate } }
          );
        } else {
          logger.error(`Error processing liability ${liability.id}:`, err);
        }
      }
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
