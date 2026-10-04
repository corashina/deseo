type ResetEvent = 'clear' | 'client';
const listeners = new Set<(event: ResetEvent) => void>();
export function onSessionReset(listener: (event: ResetEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notifySessionReset(event: ResetEvent = 'clear') { listeners.forEach((listener) => listener(event)); }
