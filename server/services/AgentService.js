function generateResponse(userInput, context) {
  const { fmi, alerts } = context;

  if (fmi?.score < 50) {
    return 'Your FMI is trending low. Reduce discretionary spends for the next 3 days and prioritize bills.';
  }

  if ((alerts || []).length > 0) {
    return `You currently have ${alerts.length} active alert(s). Focus on avoiding non-essential expenses this week.`;
  }

  if (userInput.toLowerCase().includes('save')) {
    return 'Try 50-30-20 for this week: 50% needs, 30% wants, 20% savings. I can simulate envelope impact next.';
  }

  return 'Your spending pattern is stable. Continue tracking food and shopping categories for better FMI gains.';
}

export { generateResponse };
