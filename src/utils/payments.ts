import type { AppData, Payment } from '../types/subscription';
import { isDate } from './billing';
import { currencyCodes } from './currency';

export type PaymentDraft = Pick<Payment, 'amountMinor' | 'currency' | 'paidOn'>;

/** Confirm a payment without modifying subscription prices, states or schedules. */
export function recordPayment(data: AppData, subscriptionId: string, draft: PaymentDraft, today: string, id: string, createdAt: string): AppData {
  const subscription = data.subscriptions.find(s => s.id === subscriptionId);
  if (!subscription) throw new Error('La suscripción ya no está disponible.');
  if (!isDate(draft.paidOn) || draft.paidOn > today) throw new Error('El pago debe tener una fecha válida igual o anterior a hoy.');
  if (!Number.isSafeInteger(draft.amountMinor) || draft.amountMinor <= 0 || !currencyCodes.includes(draft.currency)) throw new Error('El importe o la moneda no son válidos.');
  if (data.payments.some(p => p.subscriptionId === subscriptionId && p.paidOn === draft.paidOn && p.amountMinor === draft.amountMinor && p.currency === draft.currency)) throw new Error('Ya registraste este importe y moneda para esta suscripción en esa fecha. Revisa el historial para evitar duplicarlo.');
  const payment: Payment = { ...draft, id, subscriptionId, subscriptionName: subscription.name, createdAt };
  return { ...data, payments: [...data.payments, payment] };
}

export function paidThisYear(payments: Payment[], today: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const payment of payments) {
    if (payment.paidOn.slice(0, 4) === today.slice(0, 4) && payment.paidOn <= today) {
      totals[payment.currency] = (totals[payment.currency] ?? 0) + payment.amountMinor;
    }
  }
  return totals;
}
