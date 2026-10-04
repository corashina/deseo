import { useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { theme } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import { getPrivateStorage } from '../../../lib/private-storage';
import { registerDraftFlush } from '../../../lib/draft-lifecycle';
import type { CommandError } from '../../../lib/result';
import { createList, deleteEmptyList, moveListTasksToGeneral, renameList } from '../commands';
import { readTaskAction, writeTaskAction, removeTaskAction, type TaskAction } from '../actions';
import type { TaskList } from '../types';
type ListAction = Extract<TaskAction, { kind: 'createList' | 'renameList' | 'moveList' | 'deleteList' }>;
export function ListManager({ accountId, pairId, list, listId, online, onSaved }: { accountId: string; pairId: string; list?: TaskList; listId?: string; online: boolean; onSaved?(id: string): void }) {
  const key = `tasks:list:${list?.id ?? listId ?? 'new'}`;
  const [name, setName] = useState(list?.name ?? ''); const value = useRef(name);
  const [action, setAction] = useState<ListAction | null>(null); const [error, setError] = useState<CommandError | null>(null);
  const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const busy = useRef(false);
  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void Promise.all([readTaskAction(accountId, pairId, key), getPrivateStorage().then(storage => storage.getDraft(accountId, pairId, `${key}:name`))]).then(([saved, draftName]) => {
      scope.assertCurrent(); if (!active) return;
      if (draftName !== null) { value.current = draftName; setName(draftName); }
      if (saved && ['createList', 'renameList', 'moveList', 'deleteList'].includes(saved.kind)) { setAction(saved as ListAction); setError({ code: 'RETRYABLE', message: 'Confirm the last list change before you change it again.' }); }
      setReady(true);
    }).catch(() => { if (active) setError({ code: 'RETRYABLE', message: 'We could not open the list draft. Open this screen again.' }); });
    return () => { active = false; };
  }, [accountId, pairId, key]);
  useEffect(() => {
    if (!ready || list?.isGeneral) return;
    const scope = captureQueryScope();
    return registerDraftFlush(async () => { scope.assertCurrent(); const storage = await getPrivateStorage(); scope.assertCurrent(); await storage.setDraft(accountId, pairId, `${key}:name`, value.current); });
  }, [accountId, pairId, key, ready, list?.isGeneral]);
  const submit = async (next: ListAction) => {
    if (!online || !ready || busy.current) return;
    busy.current = true; setSaving(true); setAction(next); setError(null); const scope = captureQueryScope();
    try {
      await writeTaskAction(accountId, pairId, key, next); scope.assertCurrent();
      const result = next.kind === 'createList' ? await createList(pairId, next.name, next.commandId)
        : next.kind === 'renameList' ? await renameList(next.id, next.name, next.commandId)
        : next.kind === 'moveList' ? await moveListTasksToGeneral(next.id, next.commandId) : await deleteEmptyList(next.id, next.commandId);
      scope.assertCurrent();
      if (result.ok || result.error.code !== 'RETRYABLE') { await removeTaskAction(accountId, pairId, key); scope.assertCurrent(); setAction(null); }
      if (result.ok) {
        const storage = await getPrivateStorage(); scope.assertCurrent(); await storage.removeDraft(accountId, pairId, `${key}:name`); scope.assertCurrent();
        if (next.kind === 'createList') { value.current = ''; setName(''); onSaved?.(result.data.id); }
        if (next.kind === 'deleteList') onSaved?.(result.data.id);
      } else setError({ ...result.error, message: result.error.field === 'listNotEmpty' ? 'This list has tasks. Move them to General before you delete the list.' : result.error.code === 'CONFLICT' ? 'This list name is already in use. Choose another name.' : result.error.message });
    } catch { try { scope.assertCurrent(); setError({ code: 'RETRYABLE', message: 'We could not confirm the list change. Retry when connected.' }); } catch { /* Guard owns recovery. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* Guard owns recovery. */ } }
  };
  if (list?.isGeneral) return <Text style={theme.typography.secondary}>General keeps tasks from removed lists.</Text>;
  if (listId && !list) return <>{error && <Status tone="error" message={error.message ?? 'This list is unavailable.'} actionLabel={action ? 'Retry' : undefined} onAction={action ? () => { void submit(action); } : undefined} />}</>;
  const disabled = !online || !ready || saving || !!action;
  return <>
    <Field label={list ? 'List name' : 'New list name'} value={name} editable={ready && !saving && !action} maxLength={40} onChangeText={next => {
      setName(next); value.current = next;
      const scope = captureQueryScope(); void getPrivateStorage().then(storage => { scope.assertCurrent(); return storage.setDraft(accountId, pairId, `${key}:name`, next); }).catch(() => setError({ code: 'RETRYABLE', message: 'We could not save the list draft. Keep this screen open.' }));
    }} />
    <Button label={list ? 'Rename list' : 'Add list'} loading={saving} disabled={disabled} onPress={() => { void submit(list ? { kind: 'renameList', id: list.id, name, commandId: randomUUID() } : { kind: 'createList', name, commandId: randomUUID() }); }} />
    {list && <>
      <Button label="Move tasks to General" variant="secondary" disabled={disabled} onPress={() => Alert.alert(`Move tasks from ${list.name}?`, 'Move all tasks to General. Keep this list.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Move tasks', onPress: () => { void submit({ kind: 'moveList', id: list.id, commandId: randomUUID() }); } },
      ])} />
      <Button label="Delete empty list" variant="danger" disabled={disabled} onPress={() => Alert.alert(`Delete ${list.name}?`, 'You can delete this list only when it has no tasks.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Delete list', style: 'destructive', onPress: () => { void submit({ kind: 'deleteList', id: list.id, commandId: randomUUID() }); } },
      ])} />
    </>}
    {error && <Status tone="error" message={error.message ?? 'We could not change this list.'} actionLabel={action ? 'Retry' : undefined} onAction={action ? () => { void submit(action); } : undefined} />}
  </>;
}
