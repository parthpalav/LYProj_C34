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
