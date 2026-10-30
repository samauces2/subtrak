import { describe, expect, it } from 'vitest';
import { addDays, isDate, nextCharge, occurrence, todayLocal, totalsByCurrency, upcomingCharges } from './billing';
import type { Subscription } from '../types/subscription';
const sample: Subscription = { id: 'test', name: 'Netflix', amountMinor: 24900, currency: 'MXN', billingCycle: 'monthly', nextBillingDate: '2026-01-31', billingAnchorDate: '2026-01-31', category: 'entertainment', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
describe('calendar recurrence', () => {
  it('clips February and recovers the original day in March', () => {
    expect(nextCharge(sample, '2026-02-01')).toBe('2026-02-28');
    expect(nextCharge(sample, '2026-03-01')).toBe('2026-03-31');
    expect(occurrence(sample, 2)).toBe('2026-03-31');
  });
  it('includes a charge scheduled today', () => expect(nextCharge(sample, '2026-01-31')).toBe('2026-01-31'));
  it('does not create charges before a future reference', () => expect(nextCharge(sample, '2025-01-01')).toBe('2026-01-31'));
  it('preserves leap day for annual plans', () => {
    const s = { ...sample, billingCycle: 'yearly' as const, nextBillingDate: '2024-02-29', billingAnchorDate: '2024-02-29' };
    expect(nextCharge(s, '2025-02-01')).toBe('2025-02-28');
    expect(nextCharge(s, '2028-02-01')).toBe('2028-02-29');
  });
  it('preserves quarter phase across years', () => {
    const s = { ...sample, billingCycle: 'quarterly' as const };
    expect(nextCharge(s, '2026-02-01')).toBe('2026-04-30');
    expect(nextCharge(s, '2027-02-01')).toBe('2027-04-30');
  });
  it('advances by calendar weeks over daylight saving boundaries', () => {
    const s = { ...sample, billingCycle: 'weekly' as const, nextBillingDate: '2026-03-01', billingAnchorDate: '2026-03-01' };
    expect(nextCharge(s, '2026-03-09')).toBe('2026-03-15');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
  });
  it('keeps a normalized date from destroying the original anchor', () => expect(nextCharge({ ...sample, nextBillingDate: '2026-02-28' }, '2026-03-01')).toBe('2026-03-31'));
  it('validates actual calendar dates', () => {
    expect(isDate('2026-02-29')).toBe(false); expect(isDate('2024-02-29')).toBe(true);
    expect(isDate('2026-04-31')).toBe(false); expect(isDate('2026-1-01')).toBe(false);
  });
  it('gets today from the local calendar', () => expect(todayLocal(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28'));
});
describe('budget and upcoming', () => {
  it.each([['weekly', 5200], ['monthly', 1200], ['quarterly', 400], ['yearly', 100]] as const)('normalizes %s', (billingCycle, monthly) => {
    const t = totalsByCurrency([{ ...sample, billingCycle, amountMinor: 1200 }]).MXN;
    expect(t.monthly).toBe(monthly); expect(t.annual).toBe(monthly * 12);
  });
  it('aggregates before rounding and separates currencies', () => {
    const totals = totalsByCurrency([{ ...sample, amountMinor: 100, billingCycle: 'yearly' }, { ...sample, amountMinor: 200, billingCycle: 'yearly' }, { ...sample, currency: 'USD', amountMinor: 2000 }]);
    expect(totals.MXN.monthly).toBe(25); expect(totals.USD.monthly).toBe(2000);
  });
  it('excludes paused items from both totals and upcoming', () => {
    const s = { ...sample, status: 'paused' as const };
    expect(totalsByCurrency([s])).toEqual({}); expect(upcomingCharges([s], '2026-01-01')).toEqual([]);
  });
  it('includes every weekly occurrence in the 30-day interval and sorts', () => {
    const s = { ...sample, billingCycle: 'weekly' as const, nextBillingDate: '2026-10-28', billingAnchorDate: '2026-10-28' };
    expect(upcomingCharges([s], '2026-10-28').map(x => x.date)).toEqual(['2026-10-28','2026-11-04','2026-11-11','2026-11-18','2026-11-25']);
  });
  it('uses a 30-day half-open interval', () => {
    expect(upcomingCharges([sample], '2026-01-01')).toHaveLength(0);
    expect(upcomingCharges([sample], '2026-01-02')).toHaveLength(1);
  });
});
