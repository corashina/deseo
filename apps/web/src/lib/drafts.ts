// Memories only. Delete this file with the memories rewrite.
const drafts = new Map<string, unknown>();
const keyOf = (accountId: string, pairId: string | null, key: string) => accountId + ':' + (pairId ?? '') + ':' + key;
export function readDraft<T>(accountId: string, pairId: string | null, key: string): T | undefined {
  return drafts.get(keyOf(accountId, pairId, key)) as T | undefined;
}
export function writeDraft<T>(accountId: string, pairId: string | null, key: string, value: T): void {
  drafts.set(keyOf(accountId, pairId, key), value);
}
export function removeDraft(accountId: string, pairId: string | null, key: string): void {
  drafts.delete(keyOf(accountId, pairId, key));
}
export function clearDrafts(): void { drafts.clear(); }
export { useUnsavedChanges } from './unsaved-changes';
