import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { useCore } from '../../pair';
import { TaskAccess } from '../TaskAccess';
import { listTaskLists, taskKeys } from '../queries';
import { ListManager } from '../components/ListManager';
import { useTaskSignals } from '../realtime';
export function ListDetailScreen({ listId }: { listId: string }) { return <TaskAccess><ListEntry listId={listId} /></TaskAccess>; }
function ListEntry({ listId }: { listId: string }) {
  const core = useCore(); if (core.pair.status !== 'active') return null;
  return <Detail key={`${core.account.id}:${core.pair.pairId}:${listId}`} listId={listId} pairId={core.pair.pairId} />;
}
function Detail({ listId, pairId }: { listId: string; pairId: string }) {
  const core = useCore(); const router = useRouter();
  useTaskSignals(core.account.id, pairId, core.refresh);
  const query = useQuery({ queryKey: taskKeys.lists(core.account.id, pairId), queryFn: () => listTaskLists(pairId) });
  if (query.isPending) return <Screen title="List"><Status message="Loading list…" /></Screen>;
  if (query.isError) return <Screen title="List"><Status tone="error" message="We could not load this list." actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  const list = query.data.find(value => value.id === listId);
  return <Screen title={list?.name ?? 'List'}>
    {!core.online && <Status message="You are offline. You can keep a list name draft." />}
    {!list && <Status message="This list is unavailable." />}
    <ListManager accountId={core.account.id} pairId={pairId} listId={listId} list={list} online={core.online} onSaved={() => router.replace('/(tabs)/tasks')} />
    <Button label="See tasks" variant="secondary" onPress={() => router.replace('/(tabs)/tasks')} />
  </Screen>;
}
