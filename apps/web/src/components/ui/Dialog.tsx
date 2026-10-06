import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
export function Dialog({ open, onClose, title, children, className = '', busy = false }: { open: boolean; onClose(): void; title: string; children: ReactNode; className?: string; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node.showModal();
      node.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    }
    if (!open && node.open) { node.close(); if (trigger.current?.isConnected) trigger.current.focus(); }
  }, [open]);
  return <dialog ref={dialog} aria-label={title} className={className} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    // Native modal inertness blocks the page; wrap boundaries before focus reaches browser chrome.
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(node => node.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="dialog-heading"><h2>{title}</h2><Button variant="secondary" disabled={busy} aria-label={'Close ' + title.toLowerCase()} onClick={onClose}>Close</Button></div>
    {children}
  </dialog>;
}
