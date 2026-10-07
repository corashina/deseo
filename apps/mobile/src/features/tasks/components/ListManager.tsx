import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { theme } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import { useDraft } from '../../../lib/draft';
import type { CommandError } from '@deseo/domain/result';
import { createList, deleteEmptyList, moveListTasksToGeneral, renameList } from '../commands';
import { readTaskAction, writeTaskAction, removeTaskAction, type TaskAction } from '../actions';
import { listTaskLists } from '../queries';
import { listNameSchema } from '@deseo/domain/tasks';
import type { TaskList } from '@deseo/domain/tasks';

type ListAction = Extract<TaskAction, { kind: 'moveList' | 'deleteList' }>;
type Props = { accountId: string; pairId: string; list?: TaskList; listId?: string; online: boolean; onSaved?(id: string): void };
const nameValues = z.object({ name: z.string() });
const nameRules = z.object({ name: listNameSchema });
const nameInput = z.object({ id: z.string().uuid(), pairId: z.string().uuid(), name: listNameSchema });
type NameInput = z.infer<typeof nameInput>;

export function ListManager(props: Props) {
  // A confirmed save starts a fresh draft from the saved list.
  const [saved, setSaved] = useState<{ generation: number; list?: TaskList }>({ generation: 0, list: props.list });
  if (props.list?.isGeneral) return <Text style={theme.typography.secondary}>General keeps tasks from removed lists.</Text>;
  return <ListEditor key={saved.generation} {...props} list={saved.list ?? props.list} onNameSaved={next => {
    setSaved(current => ({ generation: current.generation + 1, list: props.list ? next : undefined }));
    if (!props.list) props.onSaved?.(next.id);
  }} />;
}

function ListEditor({ accountId, pairId, list, listId, online, onSaved, onNameSaved }: Props & { onNameSaved(list: TaskList): void }) {
  const key = `tasks:list:${list?.id ?? listId ?? 'new'}`;
  const draft = useDraft<{ name: string }, NameInput, TaskList>({
    accountId, pairId, key: `tasks:list-name:${list?.id ?? listId ?? 'new'}`,
    values: nameValues, rules: nameRules, input: nameInput, online,
    initial: { id: list?.id, expectedVersion: list?.version, values: { name: list?.name ?? '' } },
    toInput: (values, identity) => nameInput.parse({ ...values, id: identity.id, pairId }),
    command: (input, identity) => list ? renameList(list.id, input.name, identity.expectedVersion!, identity.commandId) : createList(pairId, input.name, identity.commandId),
    reload: async () => {
      const current = (await listTaskLists(pairId)).find(item => item.id === list?.id);
      return current ? { values: { name: current.name }, expectedVersion: current.version } : null;
    },
    onSaved: onNameSaved,
  });
  const [action, setAction] = useState<ListAction | null>(null); const [error, setError] = useState<CommandError | null>(null);
  const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const busy = useRef(false);
  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void readTaskAction(accountId, pairId, key).then(saved => {
      scope.assertCurrent(); if (!active) return;
      if (saved && (saved.kind === 'moveList' || saved.kind === 'deleteList')) {
        setAction(saved); setError({ code: 'RETRYABLE', message: 'Confirm the last list change before you change it again.' });
      }
      setReady(true);
    }).catch(() => { if (active) setError({ code: 'RETRYABLE', message: 'We could not open the list draft. Open this screen again.' }); });
    return () => { active = false; };
  }, [accountId, pairId, key]);
  const submit = async (next: ListAction) => {
    if (!online || !ready || busy.current) return;
    busy.current = true; setSaving(true); setAction(next); setError(null); const scope = captureQueryScope();
    try {
      await writeTaskAction(accountId, pairId, key, next); scope.assertCurrent();
      const result = next.kind === 'moveList' ? await moveListTasksToGeneral(next.id, next.commandId) : await deleteEmptyList(next.id, next.commandId);
      scope.assertCurrent();
      if (result.ok || result.error.code !== 'RETRYABLE') { await removeTaskAction(accountId, pairId, key); scope.assertCurrent(); setAction(null); }
      if (result.ok) { if (next.kind === 'deleteList') onSaved?.(result.data.id); }
      else setError({ ...result.error, message: result.error.field === 'listNotEmpty' ? 'This list has tasks. Move them to General before you delete the list.' : result.error.message });
    } catch { try { scope.assertCurrent(); setError({ code: 'RETRYABLE', message: 'We could not confirm the list change. Retry when connected.' }); } catch { /* Guard owns recovery. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* Guard owns recovery. */ } }
  };
  if (listId && !list) return <>{error && <Status tone="error" message={error.message ?? 'This list is unavailable.'} actionLabel={action ? 'Retry' : undefined} onAction={action ? () => { void submit(action); } : undefined} />}</>;
  const nameError = draft.error;
  const conflict = nameError?.code === 'CONFLICT';
  const nameLocked = !draft.ready || draft.saving || draft.frozen || conflict || draft.canRestore || !!action;
  const disabled = !online || !ready || !draft.ready || saving || draft.saving || !!action || conflict || draft.canRestore;
  return <>
    <Controller control={draft.form.control} name="name" render={({ field, fieldState }) => <Field label={list ? 'List name' : 'New list name'} value={field.value}
      onChangeText={field.onChange} error={fieldState.error?.message} editable={!nameLocked} maxLength={40} />} />
    <Button label={draft.frozen ? 'Retry save' : list ? 'Rename list' : 'Add list'} loading={draft.saving} disabled={!online || !draft.ready || draft.saving || conflict || draft.canRestore || !!action}
      onPress={() => { void (draft.frozen ? draft.retry() : draft.save()); }} />
    {draft.storageError && <Status tone="error" message={draft.storageError} />}
    {nameError && <Status tone="error" message={conflict ? 'Your partner changed this list. Review the saved name.' : nameError.message ?? 'We could not save this list.'} />}
    {conflict && <Button label="Reload saved version" variant="secondary" disabled={!online || draft.saving} onPress={() => { void draft.reloadSaved(); }} />}
    {draft.canRestore && <>
      <Status message="Review the saved name. Restore your draft to edit it." />
      <Button label="Restore my draft" variant="secondary" disabled={draft.saving} onPress={() => { void draft.restore(); }} />
    </>}
    {list && <View style={styles.listActions}>
      <Button label="Move tasks to General" variant="secondary" disabled={disabled} onPress={() => Alert.alert(`Move tasks from ${list.name}?`, 'Move all tasks to General. Keep this list.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Move tasks', onPress: () => { void submit({ kind: 'moveList', id: list.id, commandId: randomUUID() }); } },
      ])} />
      <Button label="Delete empty list" variant="danger" disabled={disabled} onPress={() => Alert.alert(`Delete ${list.name}?`, 'You can delete this list only when it has no tasks.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Delete list', style: 'destructive', onPress: () => { void submit({ kind: 'deleteList', id: list.id, commandId: randomUUID() }); } },
      ])} />
    </View>}
    {error && <Status tone="error" message={error.message ?? 'We could not change this list.'} actionLabel={action ? 'Retry' : undefined} onAction={action ? () => { void submit(action); } : undefined} />}
  </>;
}

const styles = StyleSheet.create({
  listActions: { borderTopWidth: 1, borderTopColor: theme.colors.line, marginTop: theme.space[3], paddingTop: theme.space[5], gap: theme.space[3] },
});
