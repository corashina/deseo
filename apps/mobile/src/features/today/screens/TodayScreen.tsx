import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { PairAvatars } from '../../../components/ui/Avatar';
import { Countdown } from '../../../components/ui/Countdown';
import { IconButton } from '../../../components/ui/IconButton';
import { RowGroup } from '../../../components/ui/RowGroup';
import { Section } from '../../../components/ui/Section';
import { Status } from '../../../components/ui/Status';
import { EventRow, calendarKeys, importantDateCountdown, listImportantDates, nextImportantDate } from '../../calendar';
import { getTask, listDueTasks, taskKeys, TaskRow, type Task } from '../../tasks';
import { listPinnedNotes, messageKeys, NoteCard } from '../../messages';
import { latestMemory, memoryKeys, MemoryAccessBoundary, MemoryCard } from '../../memories';
import { listNotifications, notificationKeys } from '../../notifications';
import { useCore } from '../../pair';
import { theme, ui } from '../../../theme';
import { getToday } from '../queries';
import { todayKeys } from '../keys';

export function TodayScreen() {
  const core = useCore();
  if (core.pair.status !== 'active') return null;
  return <Today key={`${core.account.id}:${core.pair.pairId}`} />;
}
function Today() {
  const { account, pair, online } = useCore();
  const activePair = pair as Extract<typeof pair, { status: 'active' }>;
  const pairId = activePair.pairId;
  const [date, setDate] = useState(() => DateTime.now().setZone(activePair.timezone).toISODate()!);
  useEffect(() => {
    const tick = () => setDate(DateTime.now().setZone(activePair.timezone).toISODate()!);
    tick(); const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [activePair.timezone]);
  const client = useQueryClient();
  const [recentTaskId, setRecentTaskId] = useState<string | null>(null);
  const query = useQuery({ queryKey: todayKeys.day(account.id, pairId, date),
    queryFn: () => getToday(pairId, date) });
  const tasks = useQuery({ queryKey: taskKeys.due(account.id, pairId, date), queryFn: () => listDueTasks(pairId, date) });
  const recentTask = useQuery({ queryKey: taskKeys.task(account.id, pairId, recentTaskId ?? ''),
    queryFn: () => getTask(pairId, recentTaskId!), enabled: recentTaskId !== null });
  const notes = useQuery({ queryKey: messageKeys.notes(account.id, pairId), queryFn: () => listPinnedNotes(pairId) });
  const notifications = useInfiniteQuery({ queryKey: notificationKeys.list(account.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listNotifications(pageParam), getNextPageParam: page => page.nextCursor ?? undefined });
  const newNotifications = !notifications.isError && notifications.data?.pages.some(page => page.items.some(item => item.readAt === null));
  const until = DateTime.fromISO(date, { zone: activePair.timezone }).plus({ days: 366 }).toISODate()!;
  const importantDates = useQuery({ queryKey: [...calendarKeys.all(account.id, pairId), 'importantDates', date, until],
    queryFn: () => listImportantDates(pairId, date, until) });
  const important = importantDates.data ? nextImportantDate(importantDates.data, activePair.timezone) : undefined;
  const countdown = important?.temporal.kind === 'allDay' ? importantDateCountdown(important.temporal.startDate, activePair.timezone) : null;
  const note = notes.data?.[0];
  const completedTask = !recentTask.isError && recentTask.data?.completedAt ? recentTask.data : null;
  const author = (id: string | null) => activePair.members.find(member => member.userId === id)?.displayName ?? 'Unassigned';
  const names = { a: activePair.members.find(member => member.slot === 'a')!.displayName, b: activePair.members.find(member => member.slot === 'b')!.displayName };
  const complete = (task: Task) => {
    client.setQueryData(taskKeys.task(account.id, pairId, task.id), task);
    setRecentTaskId(task.completedAt ? task.id : null);
  };
  const taskRow = (task: Task) => <TaskRow key={task.id} task={task} accountId={account.id} online={online}
    assignee={author(task.assigneeId)} onCompleted={complete}
    onOpen={() => router.push({ pathname: '/tasks/[taskId]', params: { taskId: task.id } })} />;
  const refresh = () => { void query.refetch(); void tasks.refetch(); void notes.refetch(); void importantDates.refetch(); void notifications.refetch();
    void client.invalidateQueries({ queryKey: memoryKeys.latest(account.id, pairId) });
    if (recentTaskId) void recentTask.refetch(); };
  const agenda = query.data?.agenda ?? [];
  return <Screen title={`Hello, ${account.displayName}`} subtitle={DateTime.now().setZone(account.timezone).toLocaleString(DateTime.DATE_HUGE)}
    toolbar={<>
      <PairAvatars members={activePair.members} onPress={() => router.push('/settings/pair')} />
      <IconButton icon="notifications-outline" label={newNotifications ? 'Notifications, new' : 'Notifications'} dot={!!newNotifications}
        onPress={() => router.push('/notifications')} />
    </>}
    action={<Button label="Add event" icon="add" compact onPress={() => router.push('/events/new')} />}
    refreshing={[query, tasks, notes, importantDates, notifications].some(result => result.isRefetching)} onRefresh={refresh}>
    {notifications.isError && <Status message="We could not load notifications." tone="error" actionLabel="Retry notifications"
      onAction={() => { void notifications.refetch(); }} />}
    <Section card title="This week" link={{ label: 'View calendar', onPress: () => router.push('/(tabs)/calendar') }}>
      {query.isPending ? <Status tone="loading" message="Loading your plans…" /> : query.error ? <Status message="We could not load your plans." tone="error"
        actionLabel="Try again" onAction={() => { void query.refetch(); }} /> : agenda.length ? <>
          {agenda.slice(0, 3).map(event => <EventRow key={event.id} event={event} viewerTimezone={account.timezone} ownerNames={names}
            onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } })} />)}
          {agenda.length > 3 && <Text style={theme.typography.secondary}>{agenda.length - 3} more this week</Text>}
        </> : <Text style={theme.typography.body}>Nothing planned this week.</Text>}
    </Section>
    <Section title="Latest memory" link={{ label: 'All memories', onPress: () => router.push('/(tabs)/memories') }}>
      <MemoryAccessBoundary><LatestMemory accountId={account.id} pairId={pairId} author={author} /></MemoryAccessBoundary>
    </Section>
    <Section title="Your note" link={{ label: 'Messages', onPress: () => router.push('/(tabs)/messages') }}>
      {notes.isPending ? <Status tone="loading" message="Loading your note…" /> : notes.isError ?
        <Status message="We could not load your note." tone="error" actionLabel="Retry note" onAction={() => { void notes.refetch(); }} /> :
        note ? <NoteCard message={note} authorName={author(note.authorId)} timezone={account.timezone} locale={account.locale} onReply={() => router.push('/(tabs)/messages')}
          onOpen={() => router.push('/(tabs)/messages')} /> : <Text style={theme.typography.body}>Pin a message to keep it here.</Text>}
    </Section>
    <Section title="Due today" link={{ label: 'All tasks', onPress: () => router.push('/(tabs)/tasks') }}>
      {tasks.isPending ? <Status tone="loading" message="Loading your tasks…" /> : tasks.isError ?
        <Status message="We could not load your tasks." tone="error" actionLabel="Retry tasks" onAction={() => { void tasks.refetch(); }} /> :
        tasks.data.length || completedTask ? <RowGroup>{tasks.data.filter(task => task.id !== completedTask?.id).map(taskRow)}</RowGroup>
          : <Text style={theme.typography.body}>No tasks due today.</Text>}
      {completedTask && <View style={ui.stack}>
        <Text style={theme.typography.secondary}>Task completed</Text><RowGroup>{taskRow(completedTask)}</RowGroup>
      </View>}
    </Section>
    <Section card title="Next important date">
      {importantDates.isPending ? <Status tone="loading" message="Loading important dates…" /> : importantDates.isError ?
        <Status message="We could not load important dates." tone="error" actionLabel="Retry dates" onAction={() => { void importantDates.refetch(); }} /> :
        important && important.temporal.kind === 'allDay' && countdown !== null ? <>
          <Countdown days={countdown} title={important.title} date={DateTime.fromISO(important.temporal.startDate, { zone: activePair.timezone }).toLocaleString(DateTime.DATE_HUGE)} />
          <Button label="View date" variant="text" trailingIcon="chevron-forward" onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: important.id } })} />
        </> : <Text style={theme.typography.body}>Add an important date in Calendar.</Text>}
    </Section>
  </Screen>;
}

function LatestMemory({ accountId, pairId, author }: { accountId: string; pairId: string; author(id: string): string }) {
  const memory = useQuery({ queryKey: memoryKeys.latest(accountId, pairId), queryFn: () => latestMemory(pairId) });
  if (memory.isPending) return <Status tone="loading" message="Loading your memory…" />;
  if (memory.isError) return <Status message="We could not load your memory." tone="error" actionLabel="Retry memory" onAction={() => { void memory.refetch(); }} />;
  if (!memory.data) return <Text style={theme.typography.body}>Save a photo from a day together.</Text>;
  return <MemoryCard memory={memory.data} authorName={author(memory.data.createdBy)}
    onOpen={() => router.push({ pathname: '/memories/[memoryId]', params: { memoryId: memory.data!.id } })} />;
}
