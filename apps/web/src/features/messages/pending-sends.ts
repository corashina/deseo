import { useEffect, useRef, useState } from 'react';
import { messageBodySchema } from '@deseo/domain/messages';
import { readDraft, writeDraft } from '../../lib/drafts';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { isOnline } from '../../lib/network';
import { sendMessage } from './commands';
import { messageKeys, reconcileMessageSends } from './queries';

export type PendingSend = { readonly clientId: string; readonly body: string; readonly failed: boolean };
type MessageDraft = { body: string; pending: readonly PendingSend[] };
const draftKey = 'messages';

export function usePendingSends(accountId: string, pairId: string) {
  const [draft, setDraft] = useState<MessageDraft>(() => readDraft(accountId, pairId, draftKey) ?? { body: '', pending: [] });
  const current = useRef(draft);
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<readonly string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const commit = (next: MessageDraft) => {
    if (!alive.current) return;
    current.current = next;
    writeDraft(accountId, pairId, draftKey, next);
    setDraft(next);
  };
  const remove = (clientId: string) => commit({ ...current.current, pending: current.current.pending.filter(row => row.clientId !== clientId) });
  const submit = async (item: PendingSend, retry: boolean) => {
    if (!isOnline() || inFlight.current.has(item.clientId)) return;
    const scope = captureQueryScope();
    inFlight.current.add(item.clientId);
    setBusy([...inFlight.current]);
    setError('');
    try {
      if (retry) {
        const known = await reconcileMessageSends(pairId, [item.clientId]);
        scope.assertCurrent();
        if (!alive.current) return;
        if (known.messages.some(message => message.clientId === item.clientId) || known.deletedClientIds.includes(item.clientId)) {
          remove(item.clientId);
          await queryClient.invalidateQueries({ queryKey: messageKeys.all(accountId, pairId) });
          return;
        }
      }
      const result = await sendMessage({ pairId, clientId: item.clientId, body: item.body });
      scope.assertCurrent();
      if (!alive.current) return;
      if (result.ok) remove(item.clientId);
      else {
        commit({ ...current.current, pending: current.current.pending.map(row => row.clientId === item.clientId ? { ...row, failed: true } : row) });
        setError('We could not confirm this message. Retry to check delivery.');
      }
    } catch {
      try {
        scope.assertCurrent();
        if (!alive.current) return;
        commit({ ...current.current, pending: current.current.pending.map(row => row.clientId === item.clientId ? { ...row, failed: true } : row) });
        setError('We could not check delivery. Your pending text is kept.');
      } catch { /* Scope reset retains the original pending send for deliberate recovery. */ }
    } finally {
      inFlight.current.delete(item.clientId);
      if (alive.current) setBusy([...inFlight.current]);
    }
  };
  const send = () => {
    const { body, pending } = current.current;
    if (!isOnline() || !messageBodySchema.safeParse(body).success || pending.length >= 100) return;
    const item: PendingSend = { clientId: crypto.randomUUID(), body, failed: false };
    // Keep the UUID and exact text before the first asynchronous request.
    commit({ body: '', pending: [...pending, item] });
    void submit(item, false);
  };
  return { ...draft, busy, error, changeBody: (body: string) => commit({ ...current.current, body }), send,
    retry: (clientId: string) => { const item = current.current.pending.find(row => row.clientId === clientId); if (item) void submit(item, true); } };
}
