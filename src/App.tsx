import { useEffect, useState, type ChangeEvent } from 'react';
import { Archive, ArrowRight, CalendarDays, CalendarRange, Download, HardDrive, Info, Layers, Pause, Play, Plus, Search, Trash2, Upload, Pencil, CircleDollarSign } from 'lucide-react';
import { categories, cycles, type AppData, type Subscription } from './types/subscription';
import { emptyData, LocalStorageRepository, parseBackup, serializeBackup, STORAGE_KEY } from './services/storage';
import { addDays, formatDate, nextCharge, todayLocal, totalsByCurrency, upcomingCharges } from './utils/billing';
import { formatMoney } from './utils/currency';
import { SubscriptionForm } from './components/SubscriptionForm';
import { Modal } from './components/Modal';
import { PaymentsDialog } from './components/PaymentsDialog';
import { paidThisYear, recordPayment, type PaymentDraft } from './utils/payments';

function initialState() {
  try { return { data: new LocalStorageRepository().load(), error: '', blocked: false }; }
  catch (error) { return { data: emptyData(), error: `No se pudieron cargar los datos. ${(error as Error).message} Puedes conservar una copia original desde Respaldos e importar un respaldo válido.`, blocked: true }; }
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Service({ subscription: s }: { subscription: Subscription }) {
  return <div className="service"><span className="avatar" aria-hidden="true">{Array.from(s.name)[0].toUpperCase()}</span><div><strong>{s.name}</strong><small>{categories[s.category]}</small></div></div>;
}
export default function App() {
  const [initial] = useState(initialState);
  const [data, setData] = useState(initial.data);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState<'dashboard' | 'list'>('dashboard');
  const [form, setForm] = useState<Subscription | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Subscription | 'all' | null>(null);
  const [backup, setBackup] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [importError, setImportError] = useState('');
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [today, setToday] = useState(todayLocal);
  useEffect(() => { const timer = setInterval(() => setToday(todayLocal()), 60000); return () => clearInterval(timer); }, []);
  // Detect another tab's writes; a reload avoids silently overwriting its changes.
  useEffect(() => { const handler = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) { setBlocked(true); setError('Los datos cambiaron en otra pestaña. Recarga esta página antes de continuar para ver la versión actual.'); } }; window.addEventListener('storage', handler); return () => window.removeEventListener('storage', handler); }, []);
  function commit(next: AppData, success: string) {
    try { new LocalStorageRepository().save(next); setData(next); setBlocked(false); setError(''); setMessage(success); return true; }
    catch { setError('No se pudieron guardar los datos. Revisa el espacio y los permisos de almacenamiento de este navegador. Los cambios no se aplicaron.'); return false; }
  }
  function save(draft: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) {
    if (blocked) return false;
    const current = form === 'new' || !form ? undefined : form;
    const timestamp = new Date().toISOString();
    const subscription: Subscription = { ...draft, id: current?.id ?? crypto.randomUUID(), createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp };
    const subscriptions = current ? data.subscriptions.map(s => s.id === current.id ? subscription : s) : [...data.subscriptions, subscription];
    if (!commit({ ...data, subscriptions }, current ? 'Suscripción actualizada.' : 'Suscripción registrada.')) return false;
    setForm(null); return true;
  }
  function toggle(s: Subscription) {
    if (blocked) return;
    commit({ ...data, subscriptions: data.subscriptions.map(item => item.id === s.id ? { ...item, status: item.status === 'active' ? 'paused' : 'active', updatedAt: new Date().toISOString() } : item) }, s.status === 'active' ? 'Suscripción pausada.' : 'Suscripción reactivada con su calendario original.');
  }
  function confirmPayment(subscriptionId: string, draft: PaymentDraft): string | null {
    if (blocked) return 'Recarga la página antes de registrar pagos: los datos no están disponibles o cambiaron en otra pestaña.';
    try {
      const next = recordPayment(data, subscriptionId, draft, today, crypto.randomUUID(), new Date().toISOString());
      return commit(next, 'Pago confirmado. El gasto real se actualizó.') ? null : 'No se pudo guardar el pago. Revisa el almacenamiento del navegador.';
    } catch (error) { return (error as Error).message; }
  }
  function removePayment(id: string): boolean {
    if (blocked) return false;
    return commit({ ...data, payments: data.payments.filter(p => p.id !== id) }, 'Pago eliminado. El gasto real se actualizó.');
  }
  function exportBackup() {
    try { download(serializeBackup(data), `subtrack-${today}.json`); setMessage('Respaldo exportado.'); }
    catch { setImportError('No se pudo generar el respaldo.'); }
  }
  function exportOriginal() {
    try { const raw = new LocalStorageRepository().raw(); if (raw === null) throw new Error(); download(raw, `subtrack-original-${today}.json`); }
    catch { setImportError('No se pudo leer el documento original de este navegador.'); }
  }
  async function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setImportError(''); setPendingImport(null); setReading(true);
    try { if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.'); setPendingImport(parseBackup(await file.text())); }
    catch (error) { setImportError((error as Error).message); }
    finally { setReading(false); }
  }
  const active = data.subscriptions.filter(s => s.status === 'active').length;
  const totals = Object.entries(totalsByCurrency(data.subscriptions));
  const paidTotals = Object.entries(paidThisYear(data.payments, today));
  const upcoming = upcomingCharges(data.subscriptions, today);
  const filtered = data.subscriptions.filter(s => s.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (status === 'all' || s.status === status) && (category === 'all' || s.category === category)).sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1));
  const money = (amount: number, currency: string) => formatMoney(amount, currency, data.settings.locale);
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><a className="brand" href="#dashboard" onClick={e => { e.preventDefault(); setPage('dashboard'); }}><span className="brand-mark">S</span>SubTrack<span className="beta">BETA</span></a><nav aria-label="Navegación principal"><button aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => setPage('dashboard')}>Dashboard</button><button aria-current={page === 'list' ? 'page' : undefined} onClick={() => setPage('list')}>Mis suscripciones</button></nav><button className="backup-button" onClick={() => { setBackup(true); setImportError(''); }}><Archive size={16}/> Respaldos</button></div></header>
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <div className="page-heading"><div><p className="eyebrow">TU ESPACIO, TUS SUSCRIPCIONES</p><h1>{page === 'dashboard' ? 'Todo bajo control.' : 'Mis suscripciones'}</h1><p className="subtitle">{page === 'dashboard' ? 'Una vista clara de lo que tienes y lo que viene.' : 'Todos tus servicios, en un solo lugar.'}</p></div><button className="primary" onClick={() => setForm('new')} disabled={blocked}><Plus size={17}/>Nueva suscripción</button></div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div aria-live="polite" className={message ? 'success-banner' : 'sr-only'}>{message}</div>
      {!data.subscriptions.length && !(page === 'dashboard' && data.payments.length) ? <section className="welcome"><div className="welcome-icon"><Layers size={27}/></div><p className="eyebrow">MENOS SORPRESAS, MÁS CLARIDAD</p><h2>Tu primera suscripción empieza aquí.</h2><p>Reúne tus servicios en un solo lugar y conoce cuánto<br className="hidden sm:block"/> representan en tu presupuesto.</p><button className="primary" disabled={blocked} onClick={() => setForm('new')}><Plus size={17}/>Agregar mi primera suscripción</button><small>Sin cuentas. Sin configuraciones previas.</small></section> : page === 'dashboard' ? <>
        <div className="metrics"><section className="metric"><div className="metric-label">Gasto mensual equivalente<CalendarDays size={17}/></div>{totals.length ? totals.map(([currency, t], i) => <div className={i === 0 ? 'metric-value' : 'metric-extra'} key={currency}>{money(t.monthly, currency)}</div>) : <div className="metric-value">—</div>}<p>Promedio mensual de tus suscripciones</p></section><section className="metric"><div className="metric-label">Gasto anual equivalente<CalendarRange size={17}/></div>{totals.length ? totals.map(([currency, t], i) => <div className={i === 0 ? 'metric-value' : 'metric-extra'} key={currency}>{money(t.annual, currency)}</div>) : <div className="metric-value">—</div>}<p>Proyección de tus planes activos</p></section><section className="metric paid-metric"><div className="metric-label">Pagado este año · {today.slice(0, 4)}<CircleDollarSign size={17}/></div>{paidTotals.length ? paidTotals.map(([currency, amount], i) => <div className={i === 0 ? 'metric-value' : 'metric-extra'} key={currency}>{money(amount, currency)}</div>) : <div className="metric-value">{money(0, data.settings.defaultCurrency)}</div>}<p>Solo pagos confirmados por ti</p><button className="text-button" onClick={() => setPaymentsFor('all')}>Ver pagos <ArrowRight size={14}/></button></section><section className="metric"><div className="metric-label">Suscripciones activas<Layers size={17}/></div><div className="metric-value">{active}</div><div className="metric-extra muted">De {data.subscriptions.length} registradas</div><p>{data.subscriptions.length - active} en pausa</p></section></div>
        <p className="budget-note"><Info size={15}/>Los equivalentes son promedios para tu presupuesto. Cada moneda se calcula por separado.</p>
        <section className="panel"><div className="panel-heading"><div><h2>Próximos cobros</h2><p>Cargos programados para los próximos 30 días</p></div><span className="date-pill">{formatDate(today)} – {formatDate(addDays(today, 29))}</span></div>{upcoming.length ? <div className="table-wrap"><table className="upcoming-table"><thead><tr><th>Suscripción</th><th>Fecha programada</th><th className="frequency">Frecuencia</th><th className="numeric">Importe</th></tr></thead><tbody>{upcoming.map(({ subscription: s, date }) => <tr key={`${s.id}-${date}`}><td><button className="service-button" disabled={blocked} onClick={() => setForm(s)} aria-label={`Editar ${s.name}`}><Service subscription={s}/></button></td><td className="date-cell">{formatDate(date)}</td><td className="frequency">{cycles[s.billingCycle]}</td><td className="numeric price">{money(s.amountMinor, s.currency)}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><CalendarDays size={24}/><h3>No hay cobros en los próximos 30 días.</h3><p>{active ? 'Tus próximas fechas quedan fuera de este periodo.' : 'Las suscripciones pausadas no generan cargos programados.'}</p></div>}<div className="panel-footer"><span>Las fechas no confirman que un pago se haya realizado.</span><button onClick={() => setPage('list')}>Ver mis suscripciones <ArrowRight size={14}/></button></div></section>
      </> : <>
        <div className="filters"><label className="search-field"><Search size={17}/><input aria-label="Buscar por nombre" placeholder="Buscar por nombre…" value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Filtrar por estado" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activas</option><option value="paused">Pausadas</option></select><select aria-label="Filtrar por categoría" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas las categorías</option>{Object.entries(categories).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
        <section className="panel"><div className="panel-heading"><h2>Tus suscripciones</h2><span className="muted text-xs" role="status">{filtered.length} suscripciones</span></div>{filtered.length ? <div className="table-wrap"><table className="subscriptions-table"><thead><tr><th>Suscripción</th><th className="numeric">Precio</th><th className="frequency">Frecuencia</th><th>Próximo cobro</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td><Service subscription={s}/></td><td className="numeric price">{money(s.amountMinor, s.currency)}<small className="mobile-cycle">{cycles[s.billingCycle]}</small></td><td className="frequency">{cycles[s.billingCycle]}</td><td className="date-cell">{s.status === 'active' ? formatDate(nextCharge(s, today)) : 'Sin programar'}</td><td className="state-cell"><span className={`state ${s.status}`}>{s.status === 'active' ? 'Activa' : 'Pausada'}</span></td><td className="actions-cell"><div className="row-actions"><button className="icon-button payment-button" disabled={blocked} onClick={() => setPaymentsFor(s)} aria-label={`Registrar pago de ${s.name}`} title="Registrar pago / ver historial"><CircleDollarSign size={17}/><span>Pagos</span></button><button className="icon-button" disabled={blocked} onClick={() => setForm(s)} aria-label={`Editar ${s.name}`} title="Editar"><Pencil size={16}/></button><button className="icon-button" disabled={blocked} onClick={() => toggle(s)} aria-label={`${s.status === 'active' ? 'Pausar' : 'Reactivar'} ${s.name}`} title={s.status === 'active' ? 'Pausar' : 'Reactivar'}>{s.status === 'active' ? <Pause size={16}/> : <Play size={16}/>}</button><button className="icon-button danger-text" disabled={blocked} onClick={() => setDeleting(s)} aria-label={`Eliminar ${s.name}`} title="Eliminar"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="empty-inline"><Search size={24}/><h3>No encontramos coincidencias.</h3><p>Prueba otro nombre o cambia los filtros.</p><button className="text-button" onClick={() => { setQuery(''); setStatus('all'); setCategory('all'); }}>Limpiar filtros</button></div>}</section>
      </>}
      <footer className="page-footer"><span><HardDrive size={15}/>Tus datos se guardan en este navegador.</span><button onClick={() => setBackup(true)}>Conservar un respaldo <ArrowRight size={14}/></button></footer>
    </main>
    {form && <SubscriptionForm subscription={form === 'new' ? undefined : form} defaultCurrency={data.settings.defaultCurrency} onSave={save} onClose={() => setForm(null)}/>}
    {paymentsFor && <PaymentsDialog subscription={paymentsFor === 'all' ? undefined : paymentsFor} payments={data.payments} today={today} locale={data.settings.locale} blocked={blocked} onSave={confirmPayment} onRemove={removePayment} onClose={() => setPaymentsFor(null)}/>}
    {deleting && <Modal title="Eliminar suscripción" onClose={() => setDeleting(null)}><p>¿Quieres eliminar <strong>{deleting.name}</strong>? Se quitará de tu lista y de las proyecciones. Sus pagos confirmados se conservarán en el historial y el gasto real. Esta acción no se puede deshacer.</p>{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary" onClick={() => setDeleting(null)}>Cancelar</button><button className="danger" disabled={blocked} onClick={() => { if (commit({ ...data, subscriptions: data.subscriptions.filter(s => s.id !== deleting.id) }, 'Suscripción eliminada.')) setDeleting(null); }}>Eliminar suscripción</button></div></Modal>}
    {backup && <Modal title="Respaldos" onClose={() => { setBackup(false); setPendingImport(null); }}>{error && <p className="field-error" role="alert">{error}</p>}<p className="backup-description">Conserva una copia de tus datos o restaura un respaldo. No hay sincronización entre dispositivos.</p><section className="backup-section"><h3>Exportar tus datos</h3><p>Descarga tus suscripciones, pagos confirmados y configuración en un archivo JSON.</p><button className="secondary" onClick={blocked ? exportOriginal : exportBackup}><Download size={16}/>{blocked ? 'Descargar documento original' : 'Exportar respaldo JSON'}</button></section><section className="backup-section"><h3>Restaurar un respaldo</h3><p>La importación reemplazará todos los datos de este navegador. Exporta una copia antes de continuar.</p><label className="file-label"><Upload size={16}/>{reading ? 'Validando archivo…' : 'Seleccionar archivo JSON'}<input type="file" accept=".json,application/json" onChange={readImport} disabled={reading}/></label>{importError && <p className="field-error" role="alert">{importError}</p>}{pendingImport && <div className="import-confirm"><h3>Respaldo válido: {pendingImport.subscriptions.length} suscripciones y {pendingImport.payments.length} pagos</h3><p>Se reemplazarán las {data.subscriptions.length} suscripciones actuales, incluidas las pausadas, y los {data.payments.length} pagos confirmados. Un respaldo anterior sin pagos dejará el historial vacío.</p><div className="modal-actions"><button className="secondary" onClick={() => setPendingImport(null)}>Cancelar</button><button className="danger" onClick={() => { if (commit(pendingImport, 'Respaldo restaurado correctamente.')) { setPendingImport(null); setBackup(false); setForm(null); } }}>Reemplazar y restaurar</button></div></div>}</section><div className="modal-actions"><button className="secondary" onClick={() => { setBackup(false); setPendingImport(null); }}>Cerrar</button></div></Modal>}
  </div>;
}
