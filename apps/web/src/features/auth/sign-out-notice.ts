import { useSyncExternalStore } from 'react';

let revision = 0;
let failed = false;
const listeners = new Set<() => void>();
const snapshot = () => failed;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function update(value: boolean) {
  if (failed === value) return;
  failed = value;
  for (const listener of listeners) listener();
}
export function clearGlobalSignOutFailure() {
  revision++;
  update(false);
}
export function startSignOutNotice() {
  clearGlobalSignOutFailure();
  const current = revision;
  return () => { if (current === revision) update(true); };
}
export function useGlobalSignOutFailure() {
  return useSyncExternalStore(subscribe, snapshot);
}
