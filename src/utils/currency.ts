export const currencyCodes = Intl.supportedValuesOf('currency');
export function currencyDigits(currency: string): number {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function parseAmount(input: string, currency: string): number {
  const digits = currencyDigits(currency);
  const pattern = digits ? new RegExp(`^\\d+(?:[.,]\\d{1,${digits}})?$`) : /^\d+$/;
  if (!pattern.test(input.trim())) throw new Error(`Ingresa un precio positivo con hasta ${digits} decimales.`);
  const [whole, fraction = ''] = input.trim().replace(',', '.').split('.');
  const value = Number(whole + fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('El precio debe ser positivo y estar dentro del rango permitido.');
  return value;
}
export function amountInput(amountMinor: number, currency: string): string {
  return (amountMinor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));
}
export function formatMoney(amountMinor: number, currency: string, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).format(amountMinor / 10 ** currencyDigits(currency));
}
