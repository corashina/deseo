import type { Page } from '@playwright/test';

export type FocusState = { name: string; ring: boolean; inView: boolean; size: number };

// Read the focused element. A ring is a solid 2px+ outline in the --focus color,
// on the element or a near ancestor, or a --focus border on a form field.
export function focusState(page: Page): Promise<FocusState | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const probe = document.createElement('i');
    probe.style.color = 'var(--focus)';
    document.body.append(probe);
    const focus = getComputedStyle(probe).color;
    probe.remove();
    const outlined = (node: Element) => {
      const s = getComputedStyle(node);
      return s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 2 && s.outlineColor === focus;
    };
    let ring = el.matches('input, select, textarea') && getComputedStyle(el).borderColor === focus;
    for (let node: Element | null = el, depth = 0; node && depth < 4 && !ring; node = node.parentElement, depth++) ring = outlined(node);
    const r = el.getBoundingClientRect();
    const field = el as HTMLInputElement;
    const name = el.getAttribute('aria-label') ?? field.labels?.[0]?.textContent?.trim() ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
    return { name, ring, inView: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth, size: r.width * r.height };
  });
}
