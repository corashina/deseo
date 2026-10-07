import { Text } from 'react-native';
import { DateTime } from 'luxon';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCore } from '../../pair';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { useTheme } from '../../../theme';
import { listMemories, memoryKeys } from '../queries';
import { MemoryCard } from '../components/MemoryCard';

export function MemoriesScreen() {
  const { account, pair, online } = useCore();
  if (pair.status !== 'active') return <Screen title="Memories"><Status message="Connect with your partner to open memories." /></Screen>;
  return <Feed accountId={account.id} pair={pair} online={online} />;
}
function Feed({ accountId, pair, online }: { accountId: string; pair: Extract<ReturnType<typeof useCore>['pair'], { status: 'active' }>; online: boolean }) {
  const router = useRouter();
  const query = useInfiniteQuery({ queryKey: memoryKeys.feed(accountId, pair.pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listMemories(pair.pairId, pageParam), getNextPageParam: page => page.nextCursor ?? undefined });
  const items = !query.isError && !query.isRefetching ? query.data?.pages.flatMap(page => page.items) ?? [] : [];
  let month = '';
  return <Screen title="Memories" onRefresh={() => { void query.refetch(); }} refreshing={query.isRefetching}
    action={<Button label="Add memory" icon="add" compact onPress={() => router.push('/memories/new')} />}>
    {!online && <Status tone="warning" message="You are offline. Reconnect to load memories." />}
    {query.isPending && <Status tone="loading" message="Loading memories…" />}
    {query.isError && <Status tone="error" message="We could not load memories." actionLabel="Retry" onAction={() => { void query.refetch(); }} />}
    {!query.isPending && !query.isError && items.length === 0 && <Status message="Add a photo from your day." actionLabel="Add memory" onAction={() => router.push('/memories/new')} />}
    {items.map(memory => {
      const group = memory.memoryDate.slice(0, 7);
      const heading = group !== month; month = group;
      return <MemoryFeedItem key={memory.id} heading={heading ? DateTime.fromISO(memory.memoryDate).toFormat('LLLL yyyy') : undefined}
        memory={memory} authorName={pair.members.find(member => member.userId === memory.createdBy)?.displayName ?? 'Former member'}
        onOpen={() => router.push({ pathname: '/memories/[memoryId]', params: { memoryId: memory.id } })} />;
    })}
    {query.hasNextPage && <Button label="Load more" variant="secondary" loading={query.isFetchingNextPage} disabled={!online} onPress={() => { void query.fetchNextPage(); }} />}
  </Screen>;
}
function MemoryFeedItem({ heading, ...props }: Parameters<typeof MemoryCard>[0] & { heading?: string }) {
  const theme = useTheme();
  return <>{heading && <Text accessibilityRole="header" style={[theme.typography.section, { paddingTop: theme.space[2] }]}>{heading}</Text>}<MemoryCard {...props} /></>;
}
