import mongoose from 'mongoose';
import CapturedTransaction from '../models/CapturedTransaction.js';
import Income from '../models/Income.js';
import Transaction from '../models/Transaction.js';

export class SmsCaptureError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Claim the pending capture, write its ledger entry and move its balance in a single
 * MongoDB transaction. A retry returns the original entry from the committed capture.
 */
export async function confirmSmsCapture(userId, capturedId, direction, saveEntry) {
  if (typeof capturedId !== 'string' || !/^cap-[a-z0-9]{1,60}$/.test(capturedId)) {
    throw new SmsCaptureError(400, 'Invalid SMS capture ID.');
  }

  const Model = direction === 'credit' ? Income : Transaction;
  const prefix = direction === 'credit' ? 'i-sms-' : 't-sms-';

  try {
    return await mongoose.connection.transaction(async (session) => {
      const ownerId = String(userId);
      const capture = await CapturedTransaction.findOne(
        { id: capturedId, userId: ownerId }, { status: 1, direction: 1 }, { session },
      ).lean();
      if (!capture) throw new SmsCaptureError(404, 'SMS capture not found.');
      if (capture.direction !== direction) throw new SmsCaptureError(409, 'This SMS belongs to a different entry type.');
      if (capture.status === 'dismissed') throw new SmsCaptureError(409, 'This SMS was dismissed.');

      const entryId = prefix + capture._id.toString();
      if (capture.status === 'confirmed') {
        const entry = await Model.findOne({ id: entryId, userId: ownerId }, null, { session }).lean();
        if (!entry) throw new SmsCaptureError(409, 'This SMS has already been confirmed.');
        return { entry, created: false };
      }

      const claim = await CapturedTransaction.updateOne(
        { _id: capture._id, userId: ownerId, status: 'pending' },
        { $set: { status: 'confirmed' } },
        { session },
      );
      if (claim.modifiedCount !== 1) throw new SmsCaptureError(409, 'This SMS is no longer pending.');

      return { entry: await saveEntry(entryId, session), created: true };
    }, { readPreference: 'primary', writeConcern: { w: 'majority' } });
  } catch (error) {
    if (error?.code === 20 && /Transaction numbers are only allowed/i.test(error.message)) {
      throw new SmsCaptureError(503, 'SMS confirmation needs a MongoDB replica set. This capture is still pending.');
    }
    throw error;
  }
}
