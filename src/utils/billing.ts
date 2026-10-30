import type { Subscription } from '../types/subscription';

export function todayLocal(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function calendarDate(value: string): Date { return new Date(`${value}T00:00:00Z`); }
export function addDays(value: string, days: number): string {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function occurrence(subscription: Subscription, index: number): string {
  const anchor = subscription.billingAnchorDate;
  if (subscription.billingCycle === 'weekly') return addDays(anchor, index * 7);
  const step = { monthly: 1, quarterly: 3, yearly: 12 }[subscription.billingCycle];
  const original = calendarDate(anchor);
  const target = calendarDate(anchor);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + index * step);
  const end = new Date(target);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(original.getUTCDate(), end.getUTCDate()));
  return target.toISOString().slice(0, 10);
}
export function nextCharge(subscription: Subscription, today: string): string {
  const lowerBound = subscription.nextBillingDate > today ? subscription.nextBillingDate : today;
  const anchor = calendarDate(subscription.billingAnchorDate);
  const current = calendarDate(lowerBound);
  let index: number;
  if (subscription.billingCycle === 'weekly') index = Math.max(0, Math.floor((current.getTime() - anchor.getTime()) / 604800000));
  else {
    const months = (current.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + current.getUTCMonth() - anchor.getUTCMonth();
    index = Math.max(0, Math.floor(months / ({ monthly: 1, quarterly: 3, yearly: 12 }[subscription.billingCycle])));
  }
  let result = occurrence(subscription, index);
  while (result < lowerBound) result = occurrence(subscription, ++index);
  return result;
}
export function totalsByCurrency(subscriptions: Subscription[]) {
  const totals: Record<string, { monthly: number; annual: number }> = {};
  for (const subscription of subscriptions.filter(s => s.status === 'active')) {
    const annual = subscription.amountMinor * ({ weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[subscription.billingCycle]);
    const total = totals[subscription.currency] ??= { monthly: 0, annual: 0 };
    total.annual += annual;
    total.monthly = total.annual / 12;
  }
  return totals;
}
export function upcomingCharges(subscriptions: Subscription[], today: string, days = 30) {
  const end = addDays(today, days);
  return subscriptions.filter(s => s.status === 'active').flatMap(subscription => {
    const dates: { subscription: Subscription; date: string }[] = [];
    let date = nextCharge(subscription, today);
    while (date < end) {
      dates.push({ subscription, date });
      date = nextCharge(subscription, addDays(date, 1));
    }
    return dates;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.subscription.name.localeCompare(b.subscription.name));
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(calendarDate(value));
}
