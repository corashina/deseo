import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { registerDraftFlush } from '../../lib/draft-lifecycle';
import { captureQueryScope } from '../../lib/query-client';
import { sendMessage } from './commands';
import { loadMessageDraft, saveMessageDraft } from './drafts';
import { reconcilePendingMessages } from './model';
import { reconcileMessageSends } from './queries';
import type { MessageDraft, PendingMessage } from './types';

const storageError = 'We could not save your draft on this device. Keep this screen open.';

export function useMessageDraft(accountId: string, pairId: string, online: boolean) {
  const [draft, setDraft] = useState<MessageDraft>({ body: '', pending: [] });
  const current = useRef(draft);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const [scope] = useState(captureQueryScope);
  const writes = useRef(Promise.resolve());
  const inFlight = useRef(new Set<string>());
  const reconciling = useRef(false);
  const commit = useCallback((next: MessageDraft) => {
    scope.assertCurrent();
    current.current = next;
    if (alive.current) setDraft(next);
  }, [scope]);
  const persist = useCallback((next: MessageDraft) => {
    const pending = writes.current.catch(() => undefined).then(async () => {
      scope.assertCurrent();
      await saveMessageDraft(accountId, pairId, next);
      scope.assertCurrent();
    });
    writes.current = pending;
    return pending;
  }, [accountId, pairId, scope]);
  const reportStorageError = useCallback(() => {
    if (alive.current) setError(storageError);
  }, []);
  useEffect(() => {
    alive.current = true;
    void loadMessageDraft(accountId, pairId).then(value => {
      scope.assertCurrent();
      if (!alive.current) return;
      commit(value); loaded.current = true; setReady(true);
    }).catch(reportStorageError);
    const unregister = registerDraftFlush(() => loaded.current ? persist(current.current) : Promise.resolve());
    return () => { alive.current = false; unregister(); };
  }, [accountId, pairId, scope, commit, persist, reportStorageError]);

  const changeBody = useCallback((body: string) => {
    if (!loaded.current) return;
    const next = { ...current.current, body };
    commit(next);
    void persist(next).catch(reportStorageError);
  }, [commit, persist, reportStorageError]);

  const submit = useCallback(async (item: PendingMessage) => {
    if (!online || !loaded.current || inFlight.current.has(item.clientId)) return;
    inFlight.current.add(item.clientId);
    try {
      scope.assertCurrent();
      await persist(current.current);
      scope.assertCurrent();
      if (!alive.current) return;
      setError(null);
      const result = await sendMessage({ pairId, clientId: item.clientId, body: item.body });
      scope.assertCurrent();
      if (!alive.current) return;
      const pending = result.ok
        ? current.current.pending.filter(row => row.clientId !== item.clientId)
        : current.current.pending.map(row => row.clientId === item.clientId ? { ...row, state: 'failed' as const } : row);
      const next = { ...current.current, pending };
      commit(next);
      await persist(next);
    } catch {
      // Never write a stale draft after account or pair access changes.
      try {
        scope.assertCurrent();
        if (!alive.current) return;
        commit({ ...current.current, pending: current.current.pending.map(row =>
          row.clientId === item.clientId ? { ...row, state: 'failed' as const } : row) });
        reportStorageError();
      } catch { /* The core has removed private access. */ }
    } finally { inFlight.current.delete(item.clientId); }
  }, [online, pairId, scope, persist, commit, reportStorageError]);

  const send = useCallback(async () => {
    const { body, pending } = current.current;
    if (!ready || !online || !body.trim() || Array.from(body).length > 4000 || pending.length >= 100) return;
    const item: PendingMessage = { clientId: randomUUID(), body, state: 'sending' };
    commit({ body: '', pending: [...pending, item] });
    await submit(item);
  }, [ready, online, commit, submit]);
  const retry = useCallback(async (clientId: string) => {
    const item = current.current.pending.find(row => row.clientId === clientId);
    if (!item || !online || inFlight.current.has(clientId)) return;
    commit({ ...current.current, pending: current.current.pending.map(row =>
      row.clientId === clientId ? { ...row, state: 'sending' as const } : row) });
    await submit(item);
  }, [online, commit, submit]);
  const discard = useCallback(async (clientId: string) => {
    if (inFlight.current.has(clientId)) return;
    const next = { ...current.current, pending: current.current.pending.filter(row => row.clientId !== clientId) };
    commit(next);
    await persist(next).catch(reportStorageError);
  }, [commit, persist, reportStorageError]);
  const reconcile = useCallback(async () => {
    if (!online || !loaded.current || reconciling.current || current.current.pending.length === 0) return;
    reconciling.current = true;
    try {
      const known = await reconcileMessageSends(pairId, current.current.pending.map(row => row.clientId));
      scope.assertCurrent();
      if (!alive.current) return;
      const pending = reconcilePendingMessages(current.current.pending, known.messages, known.deletedClientIds);
      if (pending.length === current.current.pending.length) return;
      const next = { ...current.current, pending };
      commit(next);
      await persist(next).catch(reportStorageError);
    } catch {
      if (alive.current) setError('We could not check pending messages. Refresh before retrying.');
    } finally { reconciling.current = false; }
  }, [online, pairId, scope, commit, persist, reportStorageError]);
  return { ...draft, ready, error, changeBody, send, retry, discard, reconcile };
}
