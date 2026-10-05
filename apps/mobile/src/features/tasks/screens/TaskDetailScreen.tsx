import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import type { CommandError } from '@deseo/domain/result';
import { useCore } from '../../pair';
import { ReminderControl } from '../../notifications';
import { TaskAccess } from '../TaskAccess';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { deleteTask } from '../commands';
import { readTaskAction, writeTaskAction, removeTaskAction, type TaskAction } from '../actions';
import { TaskRow } from '../components/TaskRow';
import { useTaskSignals } from '../realtime';
export function TaskDetailScreen({ taskId }: { taskId: string }) { return <TaskAccess><DetailEntry taskId={taskId} /></TaskAccess>; }
function DetailEntry({ taskId }: { taskId: string }) {
  const core = useCore(); if (core.pair.status !== 'active') return null;
  return <Detail key={`${core.account.id}:${core.pair.pairId}:${taskId}`} taskId={taskId} pairId={core.pair.pairId} />;
}
function Detail({ taskId, pairId }: { taskId: string; pairId: string }) {
  const core = useCore(); const router = useRouter();
  const query = useQuery({ queryKey: taskKeys.task(core.account.id, pairId, taskId), queryFn: () => getTask(pairId, taskId) });
  const lists = useQuery({ queryKey: taskKeys.lists(core.account.id, pairId), queryFn: () => listTaskLists(pairId) });
  useTaskSignals(core.account.id, pairId, core.refresh);
  const [action, setAction] = useState<Extract<TaskAction, { kind: 'deleteTask' }> | null>(null);
  const [error, setError] = useState<CommandError | null>(null); const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false); const busy = useRef(false); const [deleted, setDeleted] = useState(false);
  const key = `tasks:delete:${taskId}`;
  useEffect(() => {
    let active = true;
    void readTaskAction(core.account.id, pairId, key).then(saved => {
      if (!active) return;
      if (saved?.kind === 'deleteTask' && saved.id === taskId) { setAction(saved); setError({ code: 'RETRYABLE', message: 'Confirm your last delete request.' }); }
      setReady(true);
    }).catch(() => { if (active) setError({ code: 'RETRYABLE', message: 'We could not open your saved delete request. Open this screen again.' }); });
    return () => { active = false; };
  }, [core.account.id, pairId, key, taskId]);
  const submit = async (next: Extract<TaskAction, { kind: 'deleteTask' }>) => {
    if (!core.online || busy.current || !ready) return;
    const scope = captureQueryScope(); busy.current = true; setSaving(true); setAction(next); setError(null);
    try {
      await writeTaskAction(core.account.id, pairId, key, next); scope.assertCurrent();
      const result = await deleteTask(next.id, next.expectedVersion, next.commandId); scope.assertCurrent();
      if (result.ok || result.error.code !== 'RETRYABLE') { await removeTaskAction(core.account.id, pairId, key); scope.assertCurrent(); setAction(null); }
      if (result.ok) setDeleted(true); else setError(result.error);
    } catch { try { scope.assertCurrent(); setError({ code: 'RETRYABLE', message: 'We could not confirm deletion. Retry when connected.' }); } catch { /* Guard owns recovery. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* Guard owns recovery. */ } }
  };
  if (deleted) return <Screen title="Task deleted"><Status message="We deleted the task." /><Button label="See tasks" onPress={() => router.replace('/(tabs)/tasks')} /></Screen>;
  const retry = error && <Status tone="error" message={error.code === 'CONFLICT' ? 'This task changed. Reload it before you delete it.' : error.message ?? 'We could not delete this task.'} actionLabel={action ? 'Retry' : 'Reload saved version'} onAction={action ? () => { void submit(action); } : () => { void query.refetch().then(() => setError(null)); }} />;
  if (query.isPending) return <Screen title="Task"><Status message="Loading task…" /></Screen>;
  if (query.isError) return <Screen title="Task"><Status tone="error" message="We could not load this task." actionLabel="Retry" onAction={() => { void query.refetch(); }} />{retry}</Screen>;
  if (!query.data) return <Screen title="Task"><Status message="This task is unavailable." />{retry}<Button label="See tasks" onPress={() => router.replace('/(tabs)/tasks')} /></Screen>;
  const task = query.data;
  const assignee = core.pair.status === 'active' ? core.pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned' : 'Unassigned';
  return <Screen title="Task" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    {!core.online && <Status message="You are offline. You can open Edit task to keep a draft." />}
    <TaskRow task={task} accountId={core.account.id} online={core.online && !saving && !action} assignee={assignee} onOpen={() => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId } })} />
    <Text style={theme.typography.body}>List: {lists.data?.find(list => list.id === task.listId)?.name ?? (lists.isError ? 'Could not load list' : 'Loading list…')}</Text>
    {lists.isError && <Status message="We could not load the list name." actionLabel="Retry" onAction={() => { void lists.refetch(); }} />}
    <Text style={theme.typography.body}>Due: {task.dueDate ?? 'No due date'}</Text>
    <Text style={theme.typography.secondary}>Pair timezone: {core.pair.status === 'active' ? core.pair.timezone : ''}</Text>
    <ReminderControl taskId={task.id} sourceVersion={task.version} timezone={core.pair.status === 'active' ? core.pair.timezone : core.account.timezone} dueDate={task.dueDate} completed={task.completedAt !== null} />
    {retry}
    <Button label="Edit task" disabled={saving || !!action} onPress={() => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId } })} />
    <Button label="Delete task" variant="danger" loading={saving} disabled={!core.online || !ready || !!action || error?.code === 'CONFLICT'} onPress={() => Alert.alert(`Delete ${task.title}?`, 'Your partner will also lose this task.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete task', style: 'destructive', onPress: () => { void submit({ kind: 'deleteTask', id: taskId, commandId: randomUUID(), expectedVersion: task.version }); } },
    ])} />
  </Screen>;
}
