import type { PaymentMethod, PaymentMethodKind } from '../types';
import { CASH_METHOD_ID } from '../types';

export const PAYMENT_KIND_LABEL: Record<PaymentMethodKind, string> = {
  upi: 'UPI',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
};

export function paymentMethodLabel(m: PaymentMethod): string {
  const detail = m.kind === 'upi' ? m.upiId : m.last4 ? `•••• ${m.last4}` : '';
  return `${m.nickname}${detail ? ` (${detail})` : ''}`;
}

/** Label for a transaction's paymentMethodId, or null when none was recorded. */
export function transactionPaymentLabel(id: string | null | undefined, methods: PaymentMethod[]): string | null {
  if (!id) return null;
  if (id === CASH_METHOD_ID) return 'Cash';
  const m = methods.find((x) => x.id === id);
  return m ? `${PAYMENT_KIND_LABEL[m.kind]} · ${m.nickname}` : null;
}

export function ordinalDay(day: number): string {
  const s = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] || 'th';
  return `${day}${s}`;
}
