import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
export function Dialog({ open, onClose, title, children, className = '' }: { open: boolean; onClose(): void; title: string; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return <dialog ref={dialog} aria-label={title} className={className} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    // Native modal inertness blocks the page; wrap boundaries before focus reaches browser chrome.
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(node => node.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="dialog-heading"><h2>{title}</h2><Button variant="secondary" aria-label={'Close ' + title.toLowerCase()} onClick={onClose}>Close</Button></div>
    {children}
  </dialog>;
}
