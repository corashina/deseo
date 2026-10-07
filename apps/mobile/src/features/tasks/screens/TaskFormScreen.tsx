import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { useDraft } from '../../../lib/draft';
import { useTheme } from '../../../theme';
import { useCore } from '../../pair';
import { TaskAccess } from '../TaskAccess';
import { createTask, updateTask } from '../commands';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { taskFormSchema, taskInputSchema, taskValuesSchema, type TaskValues } from '@deseo/domain/tasks';
import { useTaskSignals } from '../realtime';
import type { Task, TaskInput, TaskList } from '@deseo/domain/tasks';
type Core = ReturnType<typeof useCore>;
type Props = { taskId?: string; listId?: string; quick?: boolean };
export function TaskFormScreen(props: Props) { return <TaskAccess><FormEntry {...props} /></TaskAccess>; }
function FormEntry(props: Props) {
  const core = useCore();
  if (core.pair.status !== 'active') return null;
  return <LoadForm key={`${core.account.id}:${core.pair.pairId}:${props.taskId ?? props.listId ?? 'new'}`} {...props} core={core} pairId={core.pair.pairId} />;
}
function LoadForm({ core, pairId, ...props }: Props & { core: Core; pairId: string }) {
  const lists = useQuery({ queryKey: taskKeys.lists(core.account.id, pairId), queryFn: () => listTaskLists(pairId) });
  const task = useQuery({ queryKey: taskKeys.task(core.account.id, pairId, props.taskId ?? 'new'), queryFn: () => getTask(pairId, props.taskId!), enabled: !!props.taskId });
  useTaskSignals(core.account.id, pairId, core.refresh);
  if (lists.isPending || (props.taskId && task.isPending)) return <Screen title="Task"><Status message="Loading task…" /></Screen>;
  if (lists.isError || task.isError) return <Screen title="Task"><Status message="We could not load this task." tone="error" actionLabel="Retry" onAction={() => { void lists.refetch(); if (props.taskId) void task.refetch(); }} /></Screen>;
  if ((props.taskId && !task.data) || !lists.data?.length) return <Screen title="Task"><Status message="This task or list is unavailable." /></Screen>;
  return <TaskForm {...props} core={core} pairId={pairId} lists={lists.data} task={props.taskId ? task.data! : undefined} reload={() => task.refetch()} />;
}
function valuesFor(task: Task): TaskValues { return { title: task.title, listId: task.listId, assigneeId: task.assigneeId, dueDate: task.dueDate ?? '' }; }
function TaskForm({ core, pairId, lists, task, reload, listId, quick }: Props & { core: Core; pairId: string; lists: TaskList[]; task?: Task; reload(): Promise<{ data?: Task | null }> }) {
  const theme = useTheme();
  const router = useRouter();
  const members = core.pair.status === 'active' ? core.pair.members : [];
  const [rules] = useState(() => taskFormSchema(members.map(member => member.userId)));
  const draft = useDraft<TaskValues, TaskInput, Task>({
    accountId: core.account.id, pairId, key: task ? `tasks:edit:${task.id}` : `tasks:new:${listId ?? 'general'}`,
    values: taskValuesSchema, rules, input: taskInputSchema, online: core.online,
    initial: { id: task?.id, expectedVersion: task?.version,
      values: task ? valuesFor(task) : { title: '', listId: listId ?? lists.find(list => list.isGeneral)!.id, assigneeId: null, dueDate: '' } },
    toInput: (values, identity) => taskInputSchema.parse({ ...values, dueDate: values.dueDate || null, id: identity.id, pairId }),
    command: (input, identity) => task ? updateTask(input.id, input, identity.expectedVersion!, identity.commandId) : createTask(input, identity.commandId),
    reload: async () => { const saved = (await reload()).data; return saved ? { values: valuesFor(saved), expectedVersion: saved.version } : null; },
    onSaved: saved => router.replace({ pathname: '/tasks/[taskId]', params: { taskId: saved.id } }),
  });
  const { form, ready, saving, frozen, error, storageError } = draft;
  const values = form.watch(); const locked = !ready || frozen || saving;
  const fieldError = (name: keyof TaskValues) => form.formState.errors[name]?.message;
  if (draft.savedButNotCleared) { const savedId = draft.savedButNotCleared.id; return <Screen title="Task saved"><Status message="We saved your task. We could not remove its local draft." /><Button label="Open task" onPress={() => router.replace({ pathname: '/tasks/[taskId]', params: { taskId: savedId } })} /></Screen>; }
  return <Screen title={task ? 'Edit task' : quick ? 'Quick add' : 'Add task'}>
    {!core.online && <Status message={draft.savedOnDevice ? 'You are offline. Your draft is on this device.' : 'You are offline. Keep this screen open until your draft saves.'} />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this task. Your draft is on this device.' : error.message ?? 'We could not save this task.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' ? () => { void draft.reloadSaved(); } : frozen ? () => { void draft.retry(); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={draft.dismissConflict} />}
    {draft.canRestore && <Status message="Review the saved task before you save." actionLabel="Restore my draft" onAction={() => { void draft.restore(); }} />}
    <Controller control={form.control} name="title" render={({ field }) => <Field label="Title" value={field.value} onChangeText={field.onChange} error={fieldError('title')} editable={!locked} maxLength={200} multiline />} />
    {!quick && <>
      <Text style={theme.typography.section}>List</Text><View style={theme.ui.row}>{lists.map(list => <Button key={list.id} label={list.name} disabled={locked} variant={values.listId === list.id ? 'primary' : 'secondary'} onPress={() => form.setValue('listId', list.id)} />)}</View>
      <Text style={theme.typography.section}>Assigned to</Text><View style={theme.ui.row}>
        <Button label="Unassigned" disabled={locked} variant={values.assigneeId === null ? 'primary' : 'secondary'} onPress={() => form.setValue('assigneeId', null)} />
        {members.map(member => <Button key={member.userId} label={`${member.userId === core.account.id ? 'Me' : 'Partner'} · ${member.displayName}`} disabled={locked} variant={values.assigneeId === member.userId ? 'primary' : 'secondary'} onPress={() => form.setValue('assigneeId', member.userId)} />)}
      </View>
      {fieldError('assigneeId') && <Status tone="error" message={fieldError('assigneeId')!} />}
      <Controller control={form.control} name="dueDate" render={({ field }) => <Field label="Due date (optional)" hint={`Use YYYY-MM-DD. Pair timezone: ${core.pair.status === 'active' ? core.pair.timezone : ''}.`} error={fieldError('dueDate')} value={field.value} onChangeText={field.onChange} editable={!locked} maxLength={10} />} />
    </>}
    <Button label={frozen ? 'Retry save' : task ? 'Save changes' : 'Add task'} loading={saving} disabled={!core.online || !ready || saving || error?.code === 'CONFLICT'} onPress={() => { void (frozen ? draft.retry() : draft.save()); }} />
    <Button label="Back" variant="secondary" disabled={!ready || saving} onPress={() => { void draft.leave().then(left => { if (left) router.back(); }); }} />
  </Screen>;
}
