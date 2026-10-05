import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
const drafts = new Map<string, unknown>();
let identity: string | null = null;
export function setDraftScope(accountId: string | null, pairId: string | null) {
  const next = accountId ? accountId + ':' + (pairId ?? '') : null;
  if (identity !== next) drafts.clear();
  identity = next;
}
export function readDraft<T>(accountId: string, pairId: string | null, key: string): T | undefined {
  if (identity !== accountId + ':' + (pairId ?? '')) return undefined;
  return drafts.get(key) as T | undefined;
}
export function writeDraft<T>(accountId: string, pairId: string | null, key: string, value: T): void {
  if (identity === accountId + ':' + (pairId ?? '')) drafts.set(key, value);
}
export function removeDraft(accountId: string, pairId: string | null, key: string): void {
  if (identity === accountId + ':' + (pairId ?? '')) drafts.delete(key);
}
export function useUnsavedChanges(dirty: boolean): void {
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Leave this page and discard your changes?')) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
}
