import { describe, expect, it } from 'vitest';
import { emptyData, LocalStorageRepository, parseBackup, serializeBackup, STORAGE_KEY, validateData } from './storage';
import { amountInput, currencyDigits, formatMoney, parseAmount } from '../utils/currency';
const record = { id: 'one', name: 'Netflix', amountMinor: 24900, currency: 'MXN', billingCycle: 'monthly', nextBillingDate: '2026-10-30', billingAnchorDate: '2026-10-30', category: 'entertainment', status: 'active', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z' };
const data = () => ({ ...emptyData(), subscriptions: [{ ...record }] });
describe('validated storage and backups', () => {
  it('returns empty data on first use, then persists and restores a record', () => {
    const map = new Map<string, string>();
    const repo = new LocalStorageRepository({ getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } });
    expect(repo.load()).toEqual(emptyData());
    repo.save(validateData(data())); expect(map.has(STORAGE_KEY)).toBe(true); expect(repo.load().subscriptions[0].name).toBe('Netflix');
  });
  it('round-trips an exported backup', () => expect(parseBackup(serializeBackup(validateData(data())))).toEqual(data()));
  it('rejects malformed JSON and unsupported versions', () => {
    expect(() => parseBackup('{')).toThrow(); expect(() => validateData({ ...data(), schemaVersion: 99 })).toThrow();
  });
  it.each([{ amountMinor: 0 }, { amountMinor: 1.5 }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 }, { name: '' }, { currency: 'BAD' }, { category: '__proto__' }, { billingCycle: 'toString' }, { status: 'deleted' }, { nextBillingDate: '2026-02-30' }, { billingAnchorDate: '2027-01-01' }, { notes: 2 }, { createdAt: 'yesterday' }])('rejects an invalid record: %j', change => {
    expect(() => validateData({ ...emptyData(), subscriptions: [{ ...record, ...change }] })).toThrow();
  });
  it.each(['music', 'gaming'])('migrates legacy category %s without losing records', category => {
    const restored = validateData({ ...emptyData(), subscriptions: [{ ...record, category }] });
    expect(restored.subscriptions[0].category).toBe('entertainment');
    expect(restored.subscriptions[0].id).toBe(record.id);
  });
  it.each(['streaming', 'fitness'])('restores new category %s', category => {
    expect(validateData({ ...emptyData(), subscriptions: [{ ...record, category }] }).subscriptions[0].category).toBe(category);
  });
  it('rejects duplicate IDs and invalid settings', () => {
    expect(() => validateData({ ...data(), subscriptions: [record, record] })).toThrow();
    expect(() => validateData({ ...data(), settings: { defaultCurrency: 'MXN', locale: 'not_a_locale' } })).toThrow();
  });
  it('migrates early v1 dates into stable anchors', () => {
    const { billingAnchorDate: _, ...legacy } = record;
    expect(validateData({ ...emptyData(), subscriptions: [legacy] }).subscriptions[0].billingAnchorDate).toBe(record.nextBillingDate);
  });
  it('does not overwrite malformed browser data on read', () => {
    let written = false;
    const repo = new LocalStorageRepository({ getItem: () => 'damaged', setItem: () => { written = true; } });
    expect(() => repo.load()).toThrow(); expect(written).toBe(false);
  });
  it('propagates full or unavailable storage failures', () => {
    const repo = new LocalStorageRepository({ getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } });
    expect(() => repo.load()).toThrow('blocked'); expect(() => repo.save(emptyData())).toThrow('quota');
  });
});
describe('currency minor units', () => {
  it('supports decimals without binary floating point errors', () => {
    expect(parseAmount('0.29', 'MXN')).toBe(29); expect(parseAmount('249,50', 'MXN')).toBe(24950);
    expect(amountInput(24950, 'MXN')).toBe('249.50');
  });
  it('respects zero and three decimal currencies', () => {
    expect(currencyDigits('JPY')).toBe(0); expect(parseAmount('100', 'JPY')).toBe(100);
    expect(() => parseAmount('100.1', 'JPY')).toThrow();
    expect(parseAmount('1.234', 'KWD')).toBe(1234); expect(formatMoney(1234, 'KWD')).toContain('1.234');
  });
  it.each(['-1', '0', '1e3', 'NaN', 'Infinity', '1.001', '99999999999999999'])('rejects invalid price %s', price => expect(() => parseAmount(price, 'MXN')).toThrow());
});
