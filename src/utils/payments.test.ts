import { describe, expect, it } from 'vitest';
import { recordPayment, paidThisYear } from './payments';
import { emptyData, LocalStorageRepository, parseBackup, serializeBackup, validateData } from '../services/storage';
import type { AppData, Payment, Subscription } from '../types/subscription';
const today = '2026-10-29';
const subscription: Subscription = { id: 'netflix', name: 'Netflix', amountMinor: 24900, currency: 'MXN', billingCycle: 'monthly', nextBillingDate: '2026-08-30', billingAnchorDate: '2026-08-30', category: 'streaming', status: 'active', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' };
function initial(): AppData { return { ...emptyData(), subscriptions: [{ ...subscription }] }; }
const draft = { amountMinor: 24900, currency: 'MXN', paidOn: '2026-10-28' };
const timestamp = '2026-10-29T10:00:00Z';
const sample: Payment = { ...draft, id: 'payment', subscriptionId: subscription.id, subscriptionName: subscription.name, createdAt: timestamp };
function confirm(data = initial(), fields = draft) { return recordPayment(data, subscription.id, fields, today, `payment-${data.payments.length}`, timestamp); }
describe('actual annual spending', () => {
  it('starts at zero despite past billing dates', () => expect(paidThisYear(initial().payments, today)).toEqual({}));
  it('counts exactly three confirmed monthly payments, not twelve', () => {
    let data = initial();
    for (const paidOn of ['2026-08-30', '2026-09-30', '2026-10-28']) data = confirm(data, { ...draft, paidOn });
    expect(paidThisYear(data.payments, today)).toEqual({ MXN: 74700 });
    expect(data.subscriptions).toEqual(initial().subscriptions);
    expect(initial().payments).toEqual([]);
  });
  it('uses calendar year and excludes future records', () => {
    const payments = ['2025-12-31', '2026-01-01', today, '2026-10-30', '2027-01-01'].map((paidOn, i) => ({ ...sample, id: String(i), paidOn }));
    expect(paidThisYear(payments, today)).toEqual({ MXN: 49800 });
    expect(paidThisYear(payments, '2027-01-01')).toEqual({ MXN: 24900 });
  });
  it('keeps currencies separate with integer minor units', () => {
    expect(paidThisYear([sample, { ...sample, currency: 'USD', amountMinor: 2000 }, { ...sample, currency: 'JPY', amountMinor: 500 }, { ...sample, currency: 'KWD', amountMinor: 1234 }], today)).toEqual({ MXN: 24900, USD: 2000, JPY: 500, KWD: 1234 });
  });
  it('snapshots price and name and preserves payments when the subscription is paused or removed', () => {
    const data = confirm();
    data.subscriptions[0] = { ...data.subscriptions[0], name: 'Changed name', amountMinor: 30000, status: 'paused' };
    expect(data.payments[0].subscriptionName).toBe('Netflix');
    data.subscriptions = [];
    expect(paidThisYear(data.payments, today)).toEqual({ MXN: 24900 });
    expect(validateData(data, today).payments).toHaveLength(1);
  });
  it('allows a historical payment for a paused subscription', () => {
    const data = initial(); data.subscriptions[0].status = 'paused';
    expect(confirm(data).payments).toHaveLength(1);
  });
  it('recalculates when an incorrect payment is removed', () => {
    const data = confirm();
    expect(paidThisYear(data.payments.filter(p => p.id !== data.payments[0].id), today)).toEqual({});
  });
  it('rejects a duplicate payment without changing state', () => {
    const data = confirm(); expect(() => confirm(data)).toThrow('Ya registraste'); expect(data.payments).toHaveLength(1);
  });
  it('keeps historical amounts after a price change', () => {
    const data = confirm(); data.subscriptions[0].amountMinor = 30000;
    const next = confirm(data, { ...draft, paidOn: today, amountMinor: 30000 });
    expect(paidThisYear(next.payments, today)).toEqual({ MXN: 54900 });
  });
  it.each([{ paidOn: '2026-10-30' }, { paidOn: '2026-02-30' }, { amountMinor: 0 }, { amountMinor: -100 }, { amountMinor: 1.5 }, { currency: 'BAD' }])('rejects invalid confirmation %j', change => expect(() => confirm(initial(), { ...draft, ...change })).toThrow());
  it('rejects a confirmation for a missing subscription', () => expect(() => confirm(emptyData())).toThrow('no está disponible'));
});
describe('payment storage and migration', () => {
  it('migrates v1 subscriptions with an empty payment history', () => {
    const { payments: _, ...old } = initial();
    const migrated = validateData({ ...old, schemaVersion: 1 }, today);
    expect(migrated.schemaVersion).toBe(2); expect(migrated.payments).toEqual([]); expect(migrated.subscriptions).toEqual(old.subscriptions);
  });
  it('does not discard payment data disguised as a v1 backup', () => expect(() => validateData({ ...confirm(), schemaVersion: 1 }, today)).toThrow());
  it('round-trips payments through local persistence and export/import', () => {
    const data = confirm(); const map = new Map<string, string>();
    const repo = new LocalStorageRepository({ getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } });
    repo.save(data); expect(repo.load()).toEqual(data); expect(parseBackup(serializeBackup(data))).toEqual(data);
  });
  it('requires the payment array in v2', () => {
    const { payments: _, ...missing } = initial(); expect(() => validateData(missing, today)).toThrow();
  });
  it('rejects duplicate IDs', () => expect(() => validateData({ ...initial(), payments: [sample, sample] }, today)).toThrow());
  it.each([{ amountMinor: 0 }, { amountMinor: 1.5 }, { currency: 'BAD' }, { paidOn: '2026-02-30' }, { paidOn: '2026-10-30' }, { subscriptionName: '' }, { subscriptionId: '' }, { id: '' }, { createdAt: 'yesterday' }])('rejects invalid backup payment %j', change => {
    expect(() => validateData({ ...initial(), payments: [{ ...sample, ...change }] }, today)).toThrow();
  });
});
