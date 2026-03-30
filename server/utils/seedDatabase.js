import { transactions, fmiHistory, alerts, user, envelopes } from './mockData.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import FMIHistory from '../models/FMIHistory.js';
import Alert from '../models/Alert.js';
import Envelope from '../models/Envelope.js';

async function seedDatabase() {
  const [userCount, txCount, fmiCount, alertCount, envelopeCount] = await Promise.all([
    User.countDocuments(),
    Transaction.countDocuments(),
    FMIHistory.countDocuments(),
    Alert.countDocuments(),
    Envelope.countDocuments()
  ]);

  if (userCount === 0) {
    await User.create(user);
  }

  if (txCount === 0) {
    await Transaction.insertMany(
      transactions.map((tx) => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }))
    );
  }

  if (fmiCount === 0) {
    await FMIHistory.insertMany(
      fmiHistory.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))
    );
  }

  if (alertCount === 0) {
    await Alert.insertMany(alerts);
  }

  if (envelopeCount === 0) {
    await Envelope.create(envelopes);
  }
}

export { seedDatabase };
