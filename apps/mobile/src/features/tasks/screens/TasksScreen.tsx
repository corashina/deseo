import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Chips } from '../../../components/ui/Chips';
import { RowGroup } from '../../../components/ui/RowGroup';
import { Section } from '../../../components/ui/Section';
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
  if (lists.isPending) return <Screen title="Tasks"><Status tone="loading" message="Loading lists…" /></Screen>;
  if (lists.isError) return <Screen title="Tasks"><Status tone="error" message="We could not load your lists." actionLabel="Retry" onAction={() => { void lists.refetch(); }} /></Screen>;
  if (!selectedList) return <Screen title="Tasks"><Status message="Your lists are unavailable." actionLabel="Retry" onAction={() => { void lists.refetch(); }} /></Screen>;
  const completed = tasks.data?.filter(task => task.completedAt !== null) ?? [];
  const assignee = (task: Task) => core.pair.status === 'active' ? core.pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned' : 'Unassigned';
  const row = (task: Task) => <TaskRow key={task.id} task={task} accountId={core.account.id} online={core.online} assignee={assignee(task)} onOpen={() => router.push({ pathname: '/tasks/[taskId]', params: { taskId: task.id } })} onCompleted={saved => setRecent(saved.completedAt ? saved : null)} />;
  const open = tasks.data?.filter(task => task.completedAt === null) ?? [];
  const recentRow = recent ? tasks.data?.find(task => task.id === recent.id && task.completedAt !== null) : undefined;
  return <Screen title="Tasks" onRefresh={() => { void lists.refetch(); void tasks.refetch(); }} refreshing={lists.isRefetching || tasks.isRefetching}
    action={<Button label="Add task" icon="add" compact onPress={() => router.push({ pathname: '/tasks/new', params: { listId: selectedList.id, quick: '1' } })} />}>
    {!core.online && <Status tone="warning" message="You are offline. Open Add task to keep a draft." />}
    <Chips label="Task lists" value={selectedList.id} onChange={id => { setSelected(id); setRecent(null); }}
      options={lists.data!.map(list => ({ value: list.id, label: list.name }))} />
    <Section title={selectedList.name} link={{ label: 'List details', onPress: () => router.push({ pathname: '/tasks/lists/[listId]', params: { listId: selectedList.id } }) }}>
      {tasks.isPending && <Status tone="loading" message="Loading tasks…" />}
      {tasks.isError && <Status tone="error" message="We could not load this list." actionLabel="Retry" onAction={() => { void tasks.refetch(); }} />}
      {tasks.data?.length === 0 && <Status message="This list has no tasks. Add your first task." />}
      <RowGroup>{open.map(row)}</RowGroup>
      {recentRow && <View style={ui.stack}><Text style={theme.typography.secondary}>Task completed</Text><RowGroup>{row(recentRow)}</RowGroup></View>}
      {completed.length > 0 && <Button label={`${expanded ? 'Hide' : 'Show'} completed (${completed.length})`} variant="text"
        trailingIcon={expanded ? 'chevron-up' : 'chevron-down'} onPress={() => setExpanded(!expanded)} />}
      {expanded && <RowGroup>{completed.filter(task => task.id !== recent?.id).map(row)}</RowGroup>}
    </Section>
    <Section card title="Add a list">
      <ListManager accountId={core.account.id} pairId={pairId} online={core.online} onSaved={setSelected} />
    </Section>
  </Screen>;
}
