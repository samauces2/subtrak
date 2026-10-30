import { useState, type FormEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import type { Payment, Subscription } from '../types/subscription';
import { amountInput, currencyCodes, formatMoney, parseAmount } from '../utils/currency';
import { formatDate, isDate } from '../utils/billing';
import type { PaymentDraft } from '../utils/payments';
import { Modal } from './Modal';

interface Props {
  subscription?: Subscription;
  payments: Payment[];
  today: string;
  locale: string;
  blocked: boolean;
  onSave: (subscriptionId: string, draft: PaymentDraft) => string | null;
  onRemove: (id: string) => boolean;
  onClose: () => void;
}
export function PaymentsDialog({ subscription, payments, today, locale, blocked, onSave, onRemove, onClose }: Props) {
  const [currency, setCurrency] = useState(subscription?.currency ?? 'MXN');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const history = payments.filter(p => !subscription || p.subscriptionId === subscription.id).slice().sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription) return;
    setError(''); setMessage('');
    const fields = new FormData(event.currentTarget);
    try {
      const paidOn = String(fields.get('paidOn'));
      if (!isDate(paidOn) || paidOn > today) throw new Error('Selecciona una fecha de pago igual o anterior a hoy.');
      const amountMinor = parseAmount(String(fields.get('amount')), currency);
      const failure = onSave(subscription.id, { amountMinor, currency, paidOn });
      if (failure) throw new Error(failure);
      setMessage('Pago confirmado. Ya se incluyó en el año correspondiente.');
    } catch (e) { setError((e as Error).message); }
  }
  return <Modal title={subscription ? `Pagos de ${subscription.name}` : 'Historial de pagos'} onClose={onClose}>
    {subscription && <form className="subscription-form payment-form" onSubmit={submit} noValidate>
      <p className="form-help full">Registra solo un pago que ya realizaste. Puedes añadir pagos anteriores, uno por uno. Esto no cambia el calendario ni el precio de tu suscripción.</p>
      <label>Importe pagado<input name="amount" inputMode="decimal" defaultValue={amountInput(subscription.amountMinor, subscription.currency)} required placeholder="249.00"/></label>
      <label>Moneda del pago<select value={currency} onChange={e => setCurrency(e.target.value)}>{['MXN', 'USD', 'EUR', ...currencyCodes.filter(c => !['MXN','USD','EUR'].includes(c))].map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="full">Fecha del pago<input name="paidOn" type="date" defaultValue={today} max={today} required/></label>
      <button className="primary full" type="submit" disabled={blocked}><Check size={16}/>Confirmar pago realizado</button>
    </form>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <p className={message ? 'payment-success' : 'sr-only'} role="status">{message}</p>
    <section className="payment-history" aria-label="Pagos confirmados">
      <div className="payment-history-heading"><h3>Pagos confirmados</h3><span className="muted">{history.length} registros</span></div>
      {!history.length ? <p className="form-help">Todavía no hay pagos registrados. Los cobros programados no se suman hasta que confirmes el pago.</p> : <ul>{history.map(p => <li key={p.id}>
        <div className="payment-entry"><div><strong>{p.subscriptionName}</strong><small>{formatDate(p.paidOn)}</small></div><span className="payment-amount">{formatMoney(p.amountMinor, p.currency, locale)}</span><button type="button" className="icon-button danger-text" disabled={blocked} onClick={() => { setRemoving(p.id); setError(''); setMessage(''); }} aria-label={`Eliminar pago de ${p.subscriptionName} del ${p.paidOn}`}><Trash2 size={16}/></button></div>
        {removing === p.id && <div className="payment-delete" role="group" aria-label="Confirmar eliminación del pago"><p>¿Eliminar este pago? Se descontará del gasto real. Esta acción no se puede deshacer.</p><div><button type="button" className="secondary" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className="danger" disabled={blocked} onClick={() => { if (onRemove(p.id)) { setRemoving(null); setMessage('Pago eliminado. El gasto real se actualizó.'); } else setError('No se pudo eliminar el pago. Revisa el almacenamiento o recarga la página.'); }}>Eliminar pago</button></div></div>}
      </li>)}</ul>}
    </section>
    <div className="modal-actions"><button className="secondary" type="button" onClick={onClose}>Cerrar</button></div>
  </Modal>;
}
