import type { ReactNode } from 'react';

// A tooltip for an icon button. The button opens it on hover or focus with interestfor, where the browser supports it.
// The text repeats the button's name, so it needs no ARIA. Other browsers show no tooltip, and the name still reaches screen readers.
export function Hint({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} popover="hint" className="hint">{children}</div>;
}
