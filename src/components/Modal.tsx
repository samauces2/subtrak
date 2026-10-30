import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); dialog.querySelector<HTMLInputElement>('input:not([type="file"]), select, textarea')?.focus(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="modal-heading"><div><p className="eyebrow">TUS SERVICIOS, EN ORDEN</p><h2 id="modal-title">{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div>{children}
  </dialog>;
}
