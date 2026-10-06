import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { type IdeaState } from '@deseo/domain/calendar';
import { ideaKeys, listDateIdeas } from '../date-ideas';
import { useCalendarSignals } from '../realtime';
export function IdeaListScreen() { return <CalendarAccess><Ideas /></CalendarAccess>; }
function Ideas() {
  const core = useCore(); const router = useRouter(); const [state, setState] = useState<IdeaState>('saved');
  const pairId = core.pair.status === 'active' ? core.pair.pairId : '';
  useCalendarSignals(core.account.id, pairId, core.refresh);
  const query = useInfiniteQuery({ queryKey: ideaKeys.list(core.account.id, pairId, state),
    queryFn: ({ pageParam }) => listDateIdeas(pairId, state, pageParam ?? undefined), initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor });
  return <Screen title="Saved ideas" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    {!core.online && <Status tone="warning" message="You are offline. Reconnect to refresh ideas." />}
    <Button label="Add idea" onPress={() => router.push('/ideas/new')} />
    <View style={ui.row}>{(['saved', 'planned', 'archived'] as const).map(value => <Button key={value} label={value === 'saved' ? 'Saved' : value === 'planned' ? 'Planned' : 'Archived'} variant={value === state ? 'primary' : 'secondary'} onPress={() => setState(value)} />)}</View>
    {query.isPending && <Status tone="loading" message="Loading your ideas…" />}
    {query.isError && <Status tone="error" message="We could not load your ideas." actionLabel="Retry" onAction={() => { void query.refetch(); }} />}
    {!query.isPending && !query.isError && !query.data?.pages[0]?.items.length && <Status message={`No ${state} ideas.`} />}
    {query.data?.pages.flatMap(page => page.items).map(idea => <View key={idea.id} style={ui.card}>
      <Text style={theme.typography.section}>{idea.title}</Text>
      {idea.note ? <Text style={theme.typography.body}>{idea.note}</Text> : null}
      <Button label="Open idea" variant="text" onPress={() => router.push({ pathname: '/ideas/[ideaId]', params: { ideaId: idea.id } })} />
    </View>)}
    {query.hasNextPage && <Button label="Load more" variant="secondary" loading={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} />}
  </Screen>;
}
