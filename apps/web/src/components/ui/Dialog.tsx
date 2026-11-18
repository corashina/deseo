import { useEffect, useId, useRef, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { Button } from './Button';
import { Hint } from './Hint';
// A native modal dialog. The browser keeps focus out of the page and returns it to the trigger on close.
// closedBy "any" also closes it on a click outside, where the browser supports it.
// The browser focuses the first control, which is Close. Mark the safe action with data-autofocus to focus it instead.
// React does not write the autofocus attribute, so this file moves focus.
export function Dialog({ open, onClose, title, children, id, className = '', busy = false, closedBy }: {
  open: boolean; onClose(): void; title: string; children: ReactNode; id?: string; className?: string; busy?: boolean; closedBy?: 'any';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const hintId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    // A closing dialog fades out for 120ms. Inert keeps its content away from focus and screen readers while it fades.
    node.inert = !open;
    if (open && !node.open) {
      node.showModal();
      node.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && node.open) node.close();
  }, [open]);
  // Escape and a click outside send cancel. Keep the dialog open, and let the owner decide.
  return <dialog ref={dialog} id={id} aria-labelledby={headingId} className={className} closedby={closedBy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClose={() => { if (open) onClose(); }}>
    <div className="dialog-heading"><h2 id={headingId}>{title}</h2><Button className="dialog-close" variant="text" disabled={busy} aria-label={'Close ' + title.toLowerCase()} {...{ interestfor: hintId }} onClick={onClose}><XIcon size={20} weight="bold" aria-hidden="true" /></Button><Hint id={hintId}>{'Close ' + title.toLowerCase()}</Hint></div>
    {children}
  </dialog>;
}
