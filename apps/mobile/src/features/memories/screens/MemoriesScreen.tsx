import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCore } from '../../pair';
import { ListScreen, Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { theme } from '../../../theme';
import { listMemories, memoryKeys } from '../queries';
import { MemoryCard } from '../components/MemoryCard';
import type { Memory } from '@deseo/domain/memories';

export function MemoriesScreen() {
  const { account, pair, online } = useCore();
  if (pair.status !== 'active') return <Screen title="Memories"><Status message="Connect with your partner to open memories." /></Screen>;
  return <Feed accountId={account.id} pair={pair} online={online} />;
}
type FeedRow = { memory: Memory; heading?: string };
const rowKey = (row: FeedRow) => row.memory.id;

function Feed({ accountId, pair, online }: { accountId: string; pair: Extract<ReturnType<typeof useCore>['pair'], { status: 'active' }>; online: boolean }) {
  const router = useRouter();
  const query = useInfiniteQuery({ queryKey: memoryKeys.feed(accountId, pair.pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listMemories(pair.pairId, pageParam), getNextPageParam: page => page.nextCursor ?? undefined });
  const hidden = query.isError || query.isRefetching;
  const rows = useMemo<FeedRow[]>(() => {
    if (hidden) return [];
    let month = '';
    return (query.data?.pages ?? []).flatMap(page => page.items).map(memory => {
      const group = memory.memoryDate.slice(0, 7);
      const heading = group !== month ? DateTime.fromISO(memory.memoryDate).toFormat('LLLL yyyy') : undefined;
      month = group;
      return { memory, heading };
    });
  }, [hidden, query.data]);
  const renderRow = useCallback(({ item }: { item: FeedRow }) => <MemoryFeedItem heading={item.heading} memory={item.memory}
    authorName={pair.members.find(member => member.userId === item.memory.createdBy)?.displayName ?? 'Former member'}
    onOpen={() => router.push({ pathname: '/memories/[memoryId]', params: { memoryId: item.memory.id } })} />, [pair.members, router]);
  return <ListScreen title="Memories" onRefresh={() => { void query.refetch(); }} refreshing={query.isRefetching}
    action={<Button label="Add memory" icon="add" compact onPress={() => router.push('/memories/new')} />}
    header={<>
      {!online && <Status tone="warning" message="You are offline. Reconnect to load memories." />}
      {query.isPending && <Status tone="loading" message="Loading memories…" />}
      {query.isError && <Status tone="error" message="We could not load memories." actionLabel="Retry" onAction={() => { void query.refetch(); }} />}
      {!query.isPending && !query.isError && rows.length === 0 && <Status message="Add a photo from your day." actionLabel="Add memory" onAction={() => router.push('/memories/new')} />}
    </>}
    data={rows} renderItem={renderRow} keyExtractor={rowKey}
    ListFooterComponent={query.hasNextPage ? <Button label="Load more" variant="secondary" loading={query.isFetchingNextPage} disabled={!online}
      onPress={() => { void query.fetchNextPage(); }} /> : null} />;
}
function MemoryFeedItem({ heading, ...props }: Parameters<typeof MemoryCard>[0] & { heading?: string }) {
  return <View style={styles.item}>{heading && <Text accessibilityRole="header" style={styles.heading}>{heading}</Text>}<MemoryCard {...props} /></View>;
}
const styles = StyleSheet.create({
  item: { gap: theme.space[4] }, heading: { ...theme.typography.section, paddingTop: theme.space[2] },
});
