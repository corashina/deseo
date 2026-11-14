import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
// Forms report changed input here. One guard warns before navigation or reload discards it.
const changed = new Set<symbol>();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const isChanged = () => changed.size > 0;
const shouldBlock: BlockerFunction = ({ currentLocation, nextLocation }) => isChanged()
  && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search);
export function useUnsavedChanges(dirty: boolean): void {
  const id = useRef(Symbol());
  useEffect(() => {
    if (!dirty) return;
    const key = id.current;
    changed.add(key); notify();
    return () => { changed.delete(key); notify(); };
  }, [dirty]);
}
export function UnsavedChangesGuard() {
  const dirty = useSyncExternalStore(subscribe, isChanged, () => false);
  const blocker = useBlocker(shouldBlock);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Leave this page? Your changes will be lost.')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  return null;
}
