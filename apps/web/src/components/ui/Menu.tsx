import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// Native focusgroup gives arrow keys and menu roles. Other browsers get the same from this file.
const nativeFocusGroup = 'focusGroup' in HTMLElement.prototype;
const anchored = CSS.supports('position-area: block-end');
const gap = 4;

// A popover menu in the top layer, so a scrolling parent cannot clip it. The trigger opens it with an invoker command.
export function Menu({ label, trigger, items, disabled = false, className = '' }: {
  label: string; trigger: ReactNode; items: { label: string; run(): void }[]; disabled?: boolean; className?: string;
}) {
  const menuId = useId();
  const triggerId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const keyboardOpen = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const entries = () => [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];

  // Without anchor positioning, put the menu below the trigger, or above it when it does not fit.
  function place() {
    const box = button.current!.getBoundingClientRect();
    const node = menu.current!;
    const below = box.bottom + gap + node.offsetHeight <= innerHeight;
    node.style.top = `${below ? box.bottom + gap : box.top - gap - node.offsetHeight}px`;
    node.style.left = `${Math.max(gap, box.right - node.offsetWidth)}px`;
  }

  function moveFocus(event: KeyboardEvent) {
    if (event.key === 'Tab') { menu.current!.hidePopover(); return; }
    if (nativeFocusGroup || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const list = entries();
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1
      : (current + (event.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length;
    list[next].focus();
  }

  return <div className={'menu ' + className}>
    <button ref={button} id={triggerId} type="button" className="menu-trigger" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={expanded}
      disabled={disabled} {...{ commandfor: menuId, command: 'toggle-popover' }}
      onClick={event => { if (event.detail === 0) keyboardOpen.current = true; }}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        keyboardOpen.current = true;
        if (expanded) entries()[0]?.focus(); else button.current!.click();
      }}>{trigger}</button>
    <div ref={menu} id={menuId} popover="auto" className="menu-popover" onKeyDown={moveFocus} onToggle={event => {
      const open = event.newState === 'open';
      setExpanded(open);
      if (!open) return;
      if (!anchored) place();
      // A keyboard open moves focus into the menu. A pointer open leaves it on the trigger, without a ring.
      if (keyboardOpen.current) entries()[0]?.focus(); else button.current!.focus({ focusVisible: false });
      keyboardOpen.current = false;
    }}>
      <div {...{ focusgroup: 'menu nomemory' }} role={nativeFocusGroup ? undefined : 'menu'} aria-labelledby={triggerId}>
        {items.map(item => <button key={item.label} type="button" className="button text" role={nativeFocusGroup ? undefined : 'menuitem'} disabled={disabled}
          onClick={() => { button.current!.focus({ focusVisible: false }); menu.current!.hidePopover(); item.run(); }}>{item.label}</button>)}
      </div>
    </div>
  </div>;
}
