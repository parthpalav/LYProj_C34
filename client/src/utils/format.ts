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

/** Short axis label: ₹850, ₹2.5k, ₹1.2L, ₹3Cr. */
export function formatCompact(value: number): string {
  const a = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const short = (n: number) => String(Number(n.toFixed(1)));
  if (a >= 1e7) return `${sign}₹${short(a / 1e7)}Cr`;
  if (a >= 1e5) return `${sign}₹${short(a / 1e5)}L`;
  if (a >= 1e3) return `${sign}₹${short(a / 1e3)}k`;
  return `${sign}₹${Math.round(a)}`;
}
