import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { captureQueryScope } from '../../../lib/query-client';
import { registerDraftFlush } from '../../../lib/draft-lifecycle';
import type { CommandError } from '../../../lib/result';
import { theme, ui } from '../../../theme';
import { useCore } from '../../pair';
import { TaskAccess } from '../TaskAccess';
import { createTask, updateTask } from '../commands';
import { readTaskDraft, removeTaskDraft, writeTaskDraft, type TaskDraft } from '../drafts';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { taskInputSchema } from '../schema';
import { useTaskSignals } from '../realtime';
import type { Task, TaskInput, TaskList } from '../types';
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
function valuesFor(task: Task): TaskDraft['values'] { return { title: task.title, listId: task.listId, assigneeId: task.assigneeId, dueDate: task.dueDate ?? '' }; }
function TaskForm({ core, pairId, lists, task, reload, listId, quick }: Props & { core: Core; pairId: string; lists: TaskList[]; task?: Task; reload(): Promise<{ data?: Task | null }> }) {
  const router = useRouter();
  const key = task ? `tasks:edit:${task.id}` : `tasks:new:${listId ?? 'general'}`;
  const [identity] = useState(() => ({ id: task?.id ?? randomUUID(), commandId: randomUUID(), expectedVersion: task?.version }));
  const reference = useRef(identity); const submission = useRef<TaskInput | undefined>(undefined); const pending = useRef(false); const complete = useRef(false);
  const preserved = useRef<TaskDraft['values'] | undefined>(undefined);
  const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<CommandError | null>(null); const [storageError, setStorageError] = useState<string | null>(null);
  const [canRestore, setCanRestore] = useState(false); const [savedId, setSavedId] = useState<string | null>(null);
  const form = useForm<TaskDraft['values']>({ defaultValues: task ? valuesFor(task) : { title: '', listId: listId ?? lists.find(list => list.isGeneral)!.id, assigneeId: null, dueDate: '' } });
  const values = form.watch(); const locked = !ready || frozen || saving;
  const persist = async () => { await writeTaskDraft(core.account.id, pairId, key, { ...reference.current, values: form.getValues(), submission: submission.current }); };
  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void readTaskDraft(core.account.id, pairId, key).then(draft => {
      scope.assertCurrent(); if (!active) return;
      if (draft) {
        if (task && (draft.id !== task.id || draft.expectedVersion === undefined)) throw new Error('The draft identity changed.');
        reference.current = { id: draft.id, commandId: draft.commandId, expectedVersion: draft.expectedVersion };
        form.reset(draft.values); submission.current = draft.submission; setFrozen(!!draft.submission);
        if (draft.submission) setError({ code: 'RETRYABLE', message: 'Confirm your last save before you change this draft.' });
      }
      setReady(true);
    }).catch(() => { if (active) setStorageError('We could not open your draft. Open this screen again.'); });
    return () => { active = false; };
  }, [core.account.id, pairId, key, form.reset]);
  useEffect(() => {
    if (!ready) return;
    const scope = captureQueryScope(); let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => { if (complete.current) return; scope.assertCurrent(); if (timer) clearTimeout(timer); await persist(); };
    const remove = registerDraftFlush(flush);
    const listener = form.watch(() => {
      if (complete.current || submission.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush().catch(() => setStorageError('We could not save your draft. Keep this screen open.')); }, 300);
    });
    return () => { remove(); listener.unsubscribe(); if (timer) clearTimeout(timer); void flush().catch(() => undefined); };
  }, [ready, core.account.id, pairId, key, form.watch]);
  const submit = async (input: TaskInput) => {
    if (pending.current || !core.online || !ready) return;
    const scope = captureQueryScope(); pending.current = true; setSaving(true); setError(null); submission.current = input; setFrozen(true);
    try {
      await persist(); scope.assertCurrent();
      const result = task ? await updateTask(input.id, input, reference.current.expectedVersion!, reference.current.commandId) : await createTask(input, reference.current.commandId);
      scope.assertCurrent();
      if (result.ok) {
        complete.current = true; setSavedId(result.data.id);
        await removeTaskDraft(core.account.id, pairId, key); scope.assertCurrent();
        router.replace({ pathname: '/tasks/[taskId]', params: { taskId: result.data.id } });
      } else {
        setError(result.error);
        if (result.error.code !== 'RETRYABLE') { submission.current = undefined; reference.current.commandId = randomUUID(); setFrozen(false); await persist(); }
      }
    } catch { try { scope.assertCurrent(); setStorageError(complete.current ? 'We saved your task. We could not remove its local draft.' : 'We could not save your draft. Keep this screen open.'); } catch { /* Access guard owns recovery. */ } }
    finally { pending.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* Access guard owns recovery. */ } }
  };
  const save = () => {
    const parsed = taskInputSchema.safeParse({ ...form.getValues(), dueDate: form.getValues('dueDate') || null, id: reference.current.id, pairId });
    if (!parsed.success) { setError({ code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Check the entered values.' }); return; }
    if (core.pair.status !== 'active' || (parsed.data.assigneeId && !core.pair.members.some(member => member.userId === parsed.data.assigneeId))) { setError({ code: 'VALIDATION', message: 'Choose a current pair member.' }); return; }
    void submit(parsed.data);
  };
  const reloadSaved = async () => {
    const scope = captureQueryScope(); preserved.current = form.getValues(); const result = await reload();
    try {
      scope.assertCurrent(); if (!result.data) { setError({ code: 'FORBIDDEN', message: 'This task is unavailable.' }); return; }
      reference.current.expectedVersion = result.data.version; reference.current.commandId = randomUUID(); submission.current = undefined;
      form.reset(valuesFor(result.data)); setError(null); setFrozen(false); setCanRestore(true); await persist();
    } catch { setStorageError('We could not save your draft. Keep this screen open.'); }
  };
  if (savedId) return <Screen title="Task saved"><Status message={storageError ?? 'We saved your task.'} /><Button label="Open task" onPress={() => router.replace({ pathname: '/tasks/[taskId]', params: { taskId: savedId } })} /></Screen>;
  return <Screen title={task ? 'Edit task' : quick ? 'Quick add' : 'Add task'}>
    {!core.online && <Status message="You are offline. You can keep a draft on this device." />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this task. Your draft is on this device.' : error.message ?? 'We could not save this task.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' ? () => { void reloadSaved(); } : frozen ? () => { if (submission.current) void submit(submission.current); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={() => setError(null)} />}
    {canRestore && <Status message="Review the saved task before you save." actionLabel="Restore my draft" onAction={() => { if (preserved.current) form.reset(preserved.current); setCanRestore(false); }} />}
    <Controller control={form.control} name="title" render={({ field }) => <Field label="Title" value={field.value} onChangeText={field.onChange} editable={!locked} maxLength={200} multiline />} />
    {!quick && <>
      <Text style={theme.typography.section}>List</Text><View style={ui.row}>{lists.map(list => <Button key={list.id} label={list.name} disabled={locked} variant={values.listId === list.id ? 'primary' : 'secondary'} onPress={() => form.setValue('listId', list.id)} />)}</View>
      <Text style={theme.typography.section}>Assigned to</Text><View style={ui.row}>
        <Button label="Unassigned" disabled={locked} variant={values.assigneeId === null ? 'primary' : 'secondary'} onPress={() => form.setValue('assigneeId', null)} />
        {core.pair.status === 'active' && core.pair.members.map(member => <Button key={member.userId} label={`${member.userId === core.account.id ? 'Me' : 'Partner'} · ${member.displayName}`} disabled={locked} variant={values.assigneeId === member.userId ? 'primary' : 'secondary'} onPress={() => form.setValue('assigneeId', member.userId)} />)}
      </View>
      <Controller control={form.control} name="dueDate" render={({ field }) => <Field label="Due date (optional)" hint={`Use YYYY-MM-DD. Pair timezone: ${core.pair.status === 'active' ? core.pair.timezone : ''}.`} value={field.value} onChangeText={field.onChange} editable={!locked} maxLength={10} />} />
    </>}
    <Button label={frozen ? 'Retry save' : task ? 'Save changes' : 'Add task'} loading={saving} disabled={!core.online || !ready || saving || error?.code === 'CONFLICT'} onPress={frozen ? () => { if (submission.current) void submit(submission.current); } : save} />
    <Button label="Back" variant="secondary" disabled={!ready || saving} onPress={() => { const scope = captureQueryScope(); void persist().then(() => { scope.assertCurrent(); router.back(); }).catch(() => setStorageError('We could not save your draft. Keep this screen open.')); }} />
  </Screen>;
}
