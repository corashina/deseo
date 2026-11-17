import { useEffect, useId, useRef, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { Button } from './Button';
// A native modal dialog. The browser keeps focus out of the page and returns it to the trigger on close.
// closedBy "any" also closes it on a click outside, where the browser supports it.
export function Dialog({ open, onClose, title, children, id, className = '', busy = false, closedBy }: {
  open: boolean; onClose(): void; title: string; children: ReactNode; id?: string; className?: string; busy?: boolean; closedBy?: 'any';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      node.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    }
    if (!open && node.open) node.close();
  }, [open]);
  // Escape and a click outside send cancel. Keep the dialog open, and let the owner decide.
  return <dialog ref={dialog} id={id} aria-labelledby={headingId} className={className} closedby={closedBy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClose={() => { if (open) onClose(); }}>
    <div className="dialog-heading"><h2 id={headingId}>{title}</h2><Button className="dialog-close" variant="text" disabled={busy} aria-label={'Close ' + title.toLowerCase()} title="Close" onClick={onClose}><XIcon size={20} weight="bold" aria-hidden="true" /></Button></div>
    {children}
  </dialog>;
}
