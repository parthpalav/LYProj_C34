import FMI from '../models/FMI.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { computeFmi } from '../services/fmiService.js';

export async function getFmi(req, res) {
  const userId = req.user.id;
  const user = await User.findById(userId);
  const expenses = await Expense.find({ userId }).sort({ timestamp: -1 });
  const previous = await FMI.findOne({ userId }).sort({ createdAt: -1 });

  const { score, band, dimensions, reasons, baseline } = computeFmi({
    user,
    expenses,
    currentBalance: user.currentBalance,
    previousFmi: previous
  });

  const ready = baseline.ready;
  let record = null;

  if (ready) {
    record = await FMI.create({ userId, score, band, dimensions, reasons });
  }

  res.json({
    ready,
    learning: { progress: baseline.progress, phase: baseline.phase },
    fmi: ready ? { score, band, dimensions, reasons } : null,
    record
  });
}

export async function getFmiHistory(req, res) {
  const userId = req.user.id;
  const history = await FMI.find({ userId }).sort({ createdAt: -1 }).limit(12);
  res.json(history);
}
