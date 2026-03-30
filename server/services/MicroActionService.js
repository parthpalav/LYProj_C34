function applyRoundup(tx) {
  const rounded = Math.ceil(tx.amount / 10) * 10;
  return rounded - tx.amount;
}

function allocateToEnvelope(envelopes, roundupAmount) {
  return {
    ...envelopes,
    savings: envelopes.savings + roundupAmount
  };
}

// module.exports = {
//   applyRoundup,
//   allocateToEnvelope
// };
export { applyRoundup, allocateToEnvelope };