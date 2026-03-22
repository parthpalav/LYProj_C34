function categorizeTransaction(tx) {
  const text = `${tx.description || ''}`.toLowerCase();

  if (text.includes('zomato') || text.includes('food')) return 'food';
  if (text.includes('uber') || text.includes('auto') || text.includes('metro')) return 'travel';
  if (text.includes('bill') || text.includes('recharge') || text.includes('electricity')) return 'bills';
  return tx.category || 'shopping';
}

function detectAnomaly(txList) {
  const amounts = txList.map((tx) => tx.amount);
  const avg = amounts.reduce((sum, value) => sum + value, 0) / (amounts.length || 1);
  return txList.map((tx) => ({ ...tx, isAnomaly: tx.amount > avg * 1.8 }));
}

module.exports = {
  categorizeTransaction,
  detectAnomaly
};
