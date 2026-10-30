export const cycles = { weekly: 'Semanal', monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' } as const;
export const categories = { entertainment: 'Entretenimiento', streaming: 'Streaming', fitness: 'Fitness', education: 'Educación', cloud: 'Nube', software: 'Software', other: 'Otro' } as const;
export type BillingCycle = keyof typeof cycles;
export type SubscriptionStatus = 'active' | 'paused';
export type SubscriptionCategory = keyof typeof categories;
export interface Subscription {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  billingCycle: BillingCycle;
  /** Date entered by the user; never implies a completed payment. */
  nextBillingDate: string;
  /** Stable recurrence reference: preserves month, day and cycle phase. */
  billingAnchorDate: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Payment {
  id: string;
  subscriptionId: string;
  /** Snapshot: historical payments survive renaming/deleting subscriptions. */
  subscriptionName: string;
  amountMinor: number;
  currency: string;
  paidOn: string;
  createdAt: string;
}
export interface AppData {
  schemaVersion: 2;
  settings: { defaultCurrency: string; locale: string };
  subscriptions: Subscription[];
  payments: Payment[];
}
