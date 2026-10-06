import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import type { PairContext } from '@deseo/domain/pair';
const drafts = new Map<string, unknown>();
let identity: string | null = null;
let membership: PairContext['status'] | undefined;
const dirtyForms = new Map<symbol, string | null>();
const entryDrafts = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getDirty = () => [...dirtyForms.values()].some(scope => scope === identity);
const getUnloadDirty = () => drafts.size > 0 || entryDrafts.size > 0 || getDirty();
const shouldBlock: BlockerFunction = ({ currentLocation, nextLocation }) => getDirty()
  && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search);
export function setDraftScope(accountId: string | null, pairId: string | null, pairStatus?: PairContext['status']) {
  const next = accountId ? accountId + ':' + (pairId ?? '') : null;
  if (identity !== next || membership !== pairStatus) {
    drafts.clear();
    dirtyForms.clear();
    entryDrafts.clear();
  }
  identity = next;
  membership = pairStatus;
  notify();
}
export function readDraft<T>(accountId: string, pairId: string | null, key: string): T | undefined {
  if (identity !== accountId + ':' + (pairId ?? '')) return undefined;
  return drafts.get(key) as T | undefined;
}
export function writeDraft<T>(accountId: string, pairId: string | null, key: string, value: T): void {
  if (identity === accountId + ':' + (pairId ?? '')) { drafts.set(key, value); notify(); }
}
export function removeDraft(accountId: string, pairId: string | null, key: string): void {
  if (identity === accountId + ':' + (pairId ?? '')) { drafts.delete(key); notify(); }
}
export function useUnsavedChanges(dirty: boolean, entryKey?: string): void {
  const id = useRef(Symbol());
  useEffect(() => {
    const key = id.current;
    if (dirty) dirtyForms.set(key, identity);
    else dirtyForms.delete(key);
    if (entryKey) { if (dirty) entryDrafts.add(entryKey); else entryDrafts.delete(entryKey); }
    notify();
    return () => { dirtyForms.delete(key); notify(); };
  }, [dirty, entryKey]);
}
export function UnsavedChangesGuard() {
  const dirty = useSyncExternalStore(subscribe, getUnloadDirty, () => false);
  const blocker = useBlocker(shouldBlock);
  const handled = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked') { handled.current = false; return; }
    if (!handled.current) {
      handled.current = true;
      if (window.confirm('Leave this page? Your draft stays in this tab until you sign out or reload.')) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  return null;
}
