import { useEffect, useId, useRef, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { Button } from './Button';
import { Hint } from './Hint';

const initialTarget = CSS.supports('scroll-initial-target', 'nearest');
// Any visible part of the sheet counts as open, so the dialog closes only when the sheet is fully gone.
const visible = 1 / Math.max(innerWidth, 1);

// A modal dialog that holds a sideways scroller with two snap stops: the sheet (open) and an empty spacer (closed).
// The browser moves the sheet, so a swipe drags it and a fling closes it. The backdrop fades with the scroll position.
// Every close request scrolls to the spacer. The dialog closes when the sheet has left the screen.
export function NavigationDrawer({ open, onClose, id, children }: { open: boolean; onClose(): void; id: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const hintId = useId();

  useEffect(() => {
    const node = dialog.current!;
    const observer = new IntersectionObserver(entries => {
      if (entries.at(-1)!.intersectionRatio < visible && node.open) node.close();
    }, { root: node, threshold: [visible] });
    observer.observe(sheet.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = dialog.current!;
    const area = scroller.current!;
    // While the sheet slides out, its links take no focus and screen readers skip them.
    node.inert = !open;
    if (open && !node.open) {
      node.showModal();
      void (async () => {
        // Without scroll-initial-target the dialog opens with the sheet in view. Jump to the closed stop first, so the sheet slides in.
        if (!initialTarget) {
          area.scrollTo({ left: area.scrollWidth, behavior: 'instant' });
          await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        }
        area.scrollTo({ left: 0 });
      })();
    }
    if (!open && node.open) area.scrollTo({ left: area.scrollWidth });
  }, [open]);

  // Escape sends cancel. Keep the dialog open and slide the sheet out.
  return <dialog ref={dialog} id={id} aria-labelledby={headingId} className="navigation-drawer"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClose={() => { if (open) onClose(); }}
    onClick={event => { if (!sheet.current!.contains(event.target as Node)) onClose(); }}>
    <div ref={scroller} className="drawer-scroller">
      <div ref={sheet} className="drawer-sheet">
        <div className="dialog-heading"><h2 id={headingId}>Navigation</h2><Button className="dialog-close" variant="text" aria-label="Close navigation" {...{ interestfor: hintId }} onClick={onClose}><XIcon size={20} weight="bold" aria-hidden="true" /></Button><Hint id={hintId}>Close navigation</Hint></div>
        {children}
      </div>
    </div>
  </dialog>;
}
