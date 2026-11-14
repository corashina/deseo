import { useInfiniteQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { listMemories, memoryKeys } from '../queries';
import { useMemorySignals } from '../realtime';
import { MemoryCard } from '../components/MemoryCard';
import '../../../styles/memories.css';
export function MemoriesPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  useMemorySignals(account!.id, pair);
  const query = useInfiniteQuery({ queryKey: memoryKeys.feed(account!.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listMemories(pairId, pageParam), getNextPageParam: page => page.nextCursor ?? undefined });
  const memories = query.data?.pages.flatMap(page => page.items) ?? [];
  const months = [...new Set(memories.map(memory => memory.memoryDate.slice(0, 7)))];
  return <><PageHeader title="Memories" description="Photos and moments you share." action={<Link className="button primary" to="/memories/new">Add memory</Link>} />
    {query.isPending ? <Status>Loading memories…</Status> : query.isError ? <><Status error>We could not load your memories.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> : memories.length ? months.map(month => <section className="memory-month" key={month}><h2>{formatDate(DateTime.fromISO(month + '-01'), 'month', account!.locale)}</h2><div className="memory-grid">{memories.filter(memory => memory.memoryDate.startsWith(month)).map(memory => <MemoryCard key={memory.id} memory={memory} author={pair?.status === 'active' ? pair.members.find(member => member.userId === memory.createdBy)!.displayName : ''} locale={account!.locale} />)}</div></section>) : <section className="card"><h2>Your first memory</h2><p>Add a photo, a date, and a caption.</p><Link to="/memories/new">Add memory</Link></section>}
    {query.hasNextPage && <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load older memories</Button>}
  </>;
}
