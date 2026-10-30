import { categories, cycles, type AppData, type Payment, type Subscription } from '../types/subscription';
import { isDate, todayLocal } from '../utils/billing';
import { currencyCodes } from '../utils/currency';

export const STORAGE_KEY = 'subtrack:data:v1';
export function emptyData(): AppData {
  return { schemaVersion: 2, settings: { defaultCurrency: 'MXN', locale: 'es-MX' }, subscriptions: [], payments: [] };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function timestamp(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)); }
export function validateData(input: unknown, today = todayLocal()): AppData {
  if (!record(input) || ![1, 2].includes(Number(input.schemaVersion)) || typeof input.schemaVersion !== 'number') throw new Error('El archivo tiene un formato o una versión no compatible. Los datos actuales no se han cambiado.');
  if (input.schemaVersion === 1 && input.payments !== undefined) throw new Error('Un respaldo con pagos debe usar la versión 2. No se importó ningún registro.');
  if (!record(input.settings) || typeof input.settings.defaultCurrency !== 'string' || !currencyCodes.includes(input.settings.defaultCurrency) || typeof input.settings.locale !== 'string') throw new Error('La configuración del respaldo no es válida.');
  try { new Intl.NumberFormat(input.settings.locale); } catch { throw new Error('El idioma del respaldo no es válido.'); }
  if (!Array.isArray(input.subscriptions) || input.subscriptions.length > 10000) throw new Error('El respaldo debe contener una lista de hasta 10,000 suscripciones.');
  const ids = new Set<string>();
  const subscriptions = input.subscriptions.map((s: unknown, index: number): Subscription => {
    const fail = () => new Error(`La suscripción ${index + 1} del respaldo contiene datos no válidos. No se importó ningún registro.`);
    if (!record(s) || typeof s.id !== 'string' || !s.id.trim() || ids.has(s.id) || typeof s.name !== 'string' || !s.name.trim() || s.name.trim().length > 80 || !Number.isSafeInteger(s.amountMinor) || Number(s.amountMinor) <= 0 || typeof s.currency !== 'string' || !currencyCodes.includes(s.currency) || typeof s.billingCycle !== 'string' || !Object.hasOwn(cycles, s.billingCycle) || !isDate(s.nextBillingDate) || typeof s.category !== 'string' || (!Object.hasOwn(categories, s.category) && s.category !== 'music' && s.category !== 'gaming') || !['active', 'paused'].includes(String(s.status)) || !timestamp(s.createdAt) || !timestamp(s.updatedAt) || (s.notes !== undefined && typeof s.notes !== 'string')) throw fail();
    // Early v1 records had no stable anchor. Their entered date becomes the reference.
    const anchor = s.billingAnchorDate ?? s.nextBillingDate;
    if (!isDate(anchor) || anchor > s.nextBillingDate) throw fail();
    ids.add(s.id);
    return { id: s.id, name: s.name.trim(), amountMinor: s.amountMinor as number, currency: s.currency, billingCycle: s.billingCycle as Subscription['billingCycle'], nextBillingDate: s.nextBillingDate, billingAnchorDate: anchor, category: (s.category === 'music' || s.category === 'gaming' ? 'entertainment' : s.category) as Subscription['category'], status: s.status as Subscription['status'], ...(s.notes ? { notes: s.notes as string } : {}), createdAt: s.createdAt, updatedAt: s.updatedAt };
  });
  const rawPayments = input.schemaVersion === 1 ? [] : input.payments;
  if (!Array.isArray(rawPayments) || rawPayments.length > 100000) throw new Error('La lista de pagos no es válida o supera los 100,000 registros.');
  const paymentIds = new Set<string>();
  const payments = rawPayments.map((p: unknown, index: number): Payment => {
    if (!record(p) || typeof p.id !== 'string' || !p.id.trim() || paymentIds.has(p.id) || typeof p.subscriptionId !== 'string' || !p.subscriptionId.trim() || typeof p.subscriptionName !== 'string' || !p.subscriptionName.trim() || p.subscriptionName.length > 80 || !Number.isSafeInteger(p.amountMinor) || Number(p.amountMinor) <= 0 || typeof p.currency !== 'string' || !currencyCodes.includes(p.currency) || !isDate(p.paidOn) || p.paidOn > today || !timestamp(p.createdAt)) throw new Error(`El pago ${index + 1} no es válido. No se importó ningún registro.`);
    paymentIds.add(p.id);
    return { id: p.id, subscriptionId: p.subscriptionId, subscriptionName: p.subscriptionName.trim(), amountMinor: p.amountMinor as number, currency: p.currency, paidOn: p.paidOn, createdAt: p.createdAt };
  });
  return { schemaVersion: 2, settings: { defaultCurrency: input.settings.defaultCurrency, locale: input.settings.locale }, subscriptions, payments };
}
export interface SubscriptionRepository { load(): AppData; save(data: AppData): void; }
export class LocalStorageRepository implements SubscriptionRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage) {}
  raw(): string | null { return this.storage.getItem(STORAGE_KEY); }
  load(): AppData {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw === null ? emptyData() : parseBackup(raw);
  }
  save(data: AppData) { this.storage.setItem(STORAGE_KEY, JSON.stringify(validateData(data))); }
}
export function parseBackup(raw: string): AppData {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('No se pudo leer el JSON. Conserva el archivo original y revisa su formato.'); }
  return validateData(data);
}
export function serializeBackup(data: AppData): string { return JSON.stringify(validateData(data), null, 2); }
