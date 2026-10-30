import { useState, type FormEvent } from 'react';
import { categories, cycles, type Subscription } from '../types/subscription';
import { currencyCodes, amountInput, parseAmount } from '../utils/currency';
import { isDate, todayLocal } from '../utils/billing';
import { Modal } from './Modal';

type Draft = Pick<Subscription, 'name' | 'amountMinor' | 'currency' | 'billingCycle' | 'nextBillingDate' | 'billingAnchorDate' | 'category' | 'status' | 'notes'>;
export function SubscriptionForm({ subscription, defaultCurrency, onSave, onClose }: { subscription?: Subscription; defaultCurrency: string; onSave: (draft: Draft) => boolean; onClose: () => void }) {
  const [currency, setCurrency] = useState(subscription?.currency ?? defaultCurrency);
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    const date = String(fields.get('date') ?? '');
    const nextErrors: Record<string, string> = {};
    if (!name || name.length > 80) nextErrors.name = 'Escribe un nombre de entre 1 y 80 caracteres.';
    let amountMinor = 0;
    try { amountMinor = parseAmount(String(fields.get('price') ?? ''), currency); } catch (error) { nextErrors.price = (error as Error).message; }
    if (!isDate(date)) nextErrors.date = 'Selecciona una fecha válida.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { (event.currentTarget.querySelector(`[name="${Object.keys(nextErrors)[0]}"]`) as HTMLElement)?.focus(); return; }
    const saved = onSave({ name, amountMinor, currency, billingCycle: fields.get('cycle') as Subscription['billingCycle'], nextBillingDate: date,
      billingAnchorDate: subscription && date === subscription.nextBillingDate && fields.get('cycle') === subscription.billingCycle ? subscription.billingAnchorDate : date,
      category: fields.get('category') as Subscription['category'], status: fields.get('status') as Subscription['status'], notes: String(fields.get('notes') ?? '').trim() });
    if (!saved) setErrors({ save: 'No se pudo guardar. Revisa los permisos de almacenamiento o recarga si los datos cambiaron en otra pestaña. Tus cambios siguen en este formulario.' });
  }
  return <Modal title={subscription ? 'Editar suscripción' : 'Nueva suscripción'} onClose={onClose}>
    <form className="subscription-form" onSubmit={submit} noValidate>
      <label className="full">Nombre de la suscripción <input name="name" autoFocus maxLength={80} defaultValue={subscription?.name} placeholder="Ej. Netflix" required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined}/>{errors.name && <span id="name-error" className="field-error" role="alert">{errors.name}</span>}</label>
      <label>Precio<input name="price" inputMode="decimal" defaultValue={subscription ? amountInput(subscription.amountMinor, subscription.currency) : ''} placeholder="249.00" required aria-invalid={!!errors.price} aria-describedby={errors.price ? 'price-error' : undefined}/>{errors.price && <span id="price-error" className="field-error" role="alert">{errors.price}</span>}</label>
      <label>Moneda<select name="currency" value={currency} onChange={e => setCurrency(e.target.value)}>{['MXN','USD','EUR',...currencyCodes.filter(c => !['MXN','USD','EUR'].includes(c))].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Frecuencia<select name="cycle" defaultValue={subscription?.billingCycle ?? 'monthly'}>{Object.entries(cycles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Próximo cobro<input name="date" type="date" defaultValue={subscription?.nextBillingDate ?? todayLocal()} required aria-invalid={!!errors.date} aria-describedby="date-help"/>{errors.date && <span className="field-error" role="alert">{errors.date}</span>}</label>
      <label>Categoría<select name="category" defaultValue={subscription?.category ?? 'entertainment'}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Estado<select name="status" defaultValue={subscription?.status ?? 'active'}><option value="active">Activa</option><option value="paused">Pausada</option></select></label>
      <label className="full">Notas <span className="optional">Opcional</span><textarea name="notes" rows={2} defaultValue={subscription?.notes} placeholder="Algo que quieras recordar…"/></label>
      <p className="form-help full" id="date-help">Usamos esta fecha como referencia del calendario. Si ya pasó, calcularemos la siguiente sin registrar pagos realizados. Al cambiar la fecha o frecuencia se inicia un nuevo calendario.</p>
      {errors.save && <p className="field-error full" role="alert">{errors.save}</p>}
      <div className="modal-actions full"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Guardar suscripción</button></div>
    </form>
  </Modal>;
}
