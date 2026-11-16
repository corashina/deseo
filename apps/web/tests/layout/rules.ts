import type { Page } from '@playwright/test';

export type Rule = 'side-scroll' | 'shell' | 'target' | 'clipped';
export type Failure = { rule: Rule; selector: string; detail: string };

// Intended ellipsis only. Give the reason for each entry.
const ellipsis = [
  '.topbar-label > span', // On phones each pair name keeps one line in the top bar.
  '.memory-card-copy h3', // A memory card shows three lines of the caption; the detail screen shows all.
  '.day-events .event-row-content > *', // A month cell shows two title lines and one owner line; the day list below shows all.
];

// Check the DESIGN.md Layout rules that score 90 or more at the current width.
export function checkLayout(page: Page, shell: boolean): Promise<Failure[]> {
  return page.evaluate(({ shell, ellipsis }) => {
    const out: Failure[] = [];
    const width = document.documentElement.clientWidth;
    const label = (el: Element) => el.id ? '#' + el.id : [el.tagName.toLowerCase(), ...el.classList].join('.');
    const box = (el: Element) => el.getBoundingClientRect();
    const shown = (el: Element) => {
      const r = box(el);
      return r.width > 1 && r.height > 1 && r.bottom > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const insideClip = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true;
      return false;
    };
    const all = [...document.body.querySelectorAll('*')].filter(shown);

    // Rule 1. No side scroll. Report only the outermost element past the right edge.
    const scroll = document.documentElement.scrollWidth;
    if (scroll > width) out.push({ rule: 'side-scroll', selector: 'html', detail: `scrollWidth ${scroll} > ${width}` });
    const wide = new Set<Element>();
    for (const el of all) {
      const right = box(el).right;
      if (right <= width + 0.5 || insideClip(el)) continue;
      wide.add(el);
      if (!el.parentElement || !wide.has(el.parentElement)) out.push({ rule: 'side-scroll', selector: label(el), detail: `right ${Math.round(right)} > ${width}` });
    }

    // Rule 2. Drawer below 768px, 72px rail to 1023px, 256px sidebar from 1024px.
    if (shell) {
      const sidebar = document.querySelector('.sidebar');
      const toggle = document.querySelector('.drawer-toggle');
      const want = width < 768 ? 0 : width < 1024 ? 72 : 256;
      const have = sidebar && shown(sidebar) ? Math.round(box(sidebar).width) : 0;
      if (have !== want) out.push({ rule: 'shell', selector: '.sidebar', detail: `width ${have}, want ${want}` });
      const drawer = Boolean(toggle && shown(toggle));
      if (drawer !== width < 768) out.push({ rule: 'shell', selector: '.drawer-toggle', detail: drawer ? 'shown' : 'hidden' });
    }

    // Rule 3. 48px targets. Inline links in a sentence are exempt.
    // Below 768px, DESIGN.md lets month grid day buttons be narrower, but not lower.
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary')) {
      if (!shown(el)) continue;
      if (el.matches('a') && getComputedStyle(el).display === 'inline') continue;
      const target = el.matches('input[type=checkbox], input[type=radio]') ? el.closest('label') ?? el : el;
      const r = box(target);
      const narrowDay = width < 768 && el.matches('.day-number');
      if ((!narrowDay && r.width < 47.5) || r.height < 47.5) out.push({ rule: 'target', selector: label(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}` });
    }

    // Rule 4. No element hides its own overflowing content.
    // Form fields scroll their own text natively, so long values are not clipped.
    for (const el of all) {
      if (el.matches('input, select, textarea')) continue;
      const s = getComputedStyle(el);
      if (!['hidden', 'clip'].includes(s.overflowX) && !['hidden', 'clip'].includes(s.overflowY)) continue;
      if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) continue;
      if (ellipsis.some(selector => el.matches(selector))) continue;
      out.push({ rule: 'clipped', selector: label(el), detail: `${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}` });
    }
    return out;
  }, { shell, ellipsis });
}
