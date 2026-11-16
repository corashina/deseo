import { useEffect, useRef, useState } from 'react';
// One observer serves every element. It reports an element once, when it comes within one screen of the viewport.
const callbacks = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;
function shared() {
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) callbacks.get(entry.target)?.();
  }, { rootMargin: '100% 0px' });
  return observer;
}
export function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const watcher = shared();
    callbacks.set(element, () => setNear(true));
    watcher.observe(element);
    return () => { watcher.unobserve(element); callbacks.delete(element); };
  }, [near]);
  return [ref, near] as const;
}
