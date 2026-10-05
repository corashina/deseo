import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { useCore } from '../../pair';
import { TaskAccess } from '../TaskAccess';
import { listTaskLists, listTasks, taskKeys } from '../queries';
import { useTaskSignals } from '../realtime';
import { TaskRow } from '../components/TaskRow';
import { ListManager } from '../components/ListManager';
import type { Task } from '@deseo/domain/tasks';
export function TasksScreen() { return <TaskAccess><TasksEntry /></TaskAccess>; }
function TasksEntry() {
  const core = useCore(); if (core.pair.status !== 'active') return null;
  return <Tasks key={`${core.account.id}:${core.pair.pairId}`} pairId={core.pair.pairId} />;
}
function Tasks({ pairId }: { pairId: string }) {
  const core = useCore(); const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null); const [expanded, setExpanded] = useState(false);
  const [recent, setRecent] = useState<Task | null>(null);
  useTaskSignals(core.account.id, pairId, core.refresh);
  const lists = useQuery({ queryKey: taskKeys.lists(core.account.id, pairId), queryFn: () => listTaskLists(pairId) });
  const selectedList = lists.data?.find(list => list.id === selected) ?? lists.data?.find(list => list.isGeneral);
  const tasks = useQuery({ queryKey: taskKeys.list(core.account.id, pairId, selectedList?.id ?? ''), queryFn: () => listTasks(pairId, selectedList!.id), enabled: !!selectedList });
  if (lists.isPending) return <Screen title="Tasks"><Status message="Loading lists…" /></Screen>;
  if (lists.isError) return <Screen title="Tasks"><Status tone="error" message="We could not load your lists." actionLabel="Retry" onAction={() => { void lists.refetch(); }} /></Screen>;
  if (!selectedList) return <Screen title="Tasks"><Status message="Your lists are unavailable." actionLabel="Retry" onAction={() => { void lists.refetch(); }} /></Screen>;
  const completed = tasks.data?.filter(task => task.completedAt !== null) ?? [];
  const assignee = (task: Task) => core.pair.status === 'active' ? core.pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned' : 'Unassigned';
  const row = (task: Task) => <TaskRow key={task.id} task={task} accountId={core.account.id} online={core.online} assignee={assignee(task)} onOpen={() => router.push({ pathname: '/tasks/[taskId]', params: { taskId: task.id } })} onCompleted={saved => setRecent(saved.completedAt ? saved : null)} />;
  return <Screen title="Tasks" onRefresh={() => { void lists.refetch(); void tasks.refetch(); }} refreshing={lists.isRefetching || tasks.isRefetching}>
    {!core.online && <Status message="You are offline. Open Add task to keep a draft." />}
    <View style={ui.row}>{lists.data!.map(list => <Button key={list.id} label={list.name} variant={selectedList.id === list.id ? 'primary' : 'secondary'} onPress={() => { setSelected(list.id); setRecent(null); }} />)}</View>
    <View style={ui.row}><Button label="Add task" onPress={() => router.push({ pathname: '/tasks/new', params: { listId: selectedList.id, quick: '1' } })} />
      <Button label="List details" variant="secondary" onPress={() => router.push({ pathname: '/tasks/lists/[listId]', params: { listId: selectedList.id } })} /></View>
    {tasks.isPending && <Status message="Loading tasks…" />}
    {tasks.isError && <Status tone="error" message="We could not load this list." actionLabel="Retry" onAction={() => { void tasks.refetch(); }} />}
    {tasks.data?.length === 0 && <Status message="This list has no tasks. Add your first task." />}
    {tasks.data?.filter(task => task.completedAt === null).map(row)}
    {recent && tasks.data?.find(task => task.id === recent.id && task.completedAt !== null) && <View style={ui.stack}><Text style={theme.typography.section}>Task completed</Text>{row(tasks.data.find(task => task.id === recent.id)!)}</View>}
    <Button label={`${expanded ? 'Hide' : 'Show'} completed (${completed.length})`} variant="secondary" onPress={() => setExpanded(!expanded)} />
    {expanded && completed.filter(task => task.id !== recent?.id).map(row)}
    <Text style={theme.typography.section}>Add a list</Text>
    <ListManager accountId={core.account.id} pairId={pairId} online={core.online} onSaved={setSelected} />
  </Screen>;
}
