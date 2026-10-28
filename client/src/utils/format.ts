export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

export function humanDate(input: string): string {
  return new Date(input).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short'
  });
}

/** Recurring amount expressed per month. */
export function monthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case 'daily': return (amount * 365) / 12;
    case 'weekly': return (amount * 52) / 12;
    case 'yearly': return amount / 12;
    default: return amount;
  }
}
