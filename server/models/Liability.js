import mongoose from 'mongoose';
import { VALID_CATEGORIES, VALID_TYPES } from './Transaction.js';

const liabilitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    amount: { 
      type: Number, 
      required: true,
      validate: {
        validator: (v) => Number.isFinite(v) && v > 0,
        message: 'Amount must be a finite positive number'
      }
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: VALID_CATEGORIES,
        message: 'Category must be one of: ' + VALID_CATEGORIES.join(', ')
      }
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: VALID_TYPES,
        message: 'Type must be one of: ' + VALID_TYPES.join(', ')
      }
    },
    autoDeduct: { type: Boolean, default: false },
    frequency: { 
      type: String, 
      required: true,
      enum: ['daily', 'weekly', 'monthly', 'yearly'] 
    },
    startDate: { type: Date, required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, default: null }, // 0 (Sunday) to 6 (Saturday)
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    monthOfYear: { type: Number, min: 1, max: 12, default: null }, // 1 (Jan) to 12 (Dec)
    nextDueDate: { type: Date, default: null },
    status: { type: String, enum: ['active', 'deleted'], default: 'active' } // Soft delete
  },
  { timestamps: true, versionKey: false }
);

liabilitySchema.index({ userId: 1, status: 1 });
liabilitySchema.index({ autoDeduct: 1, status: 1, nextDueDate: 1 });

export default mongoose.model('Liability', liabilitySchema);
