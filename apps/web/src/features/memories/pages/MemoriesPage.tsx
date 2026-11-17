import { useInfiniteQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Memory } from '@deseo/domain/memories';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { listMemories, memoryKeys } from '../queries';
import { MemoryCard } from '../components/MemoryCard';
import '../../../styles/memories.css';
export function MemoriesPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useInfiniteQuery({ queryKey: memoryKeys.feed(account!.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listMemories(pairId, pageParam), getNextPageParam: page => page.nextCursor ?? undefined });
  // Group by month in one pass. The feed comes newest first, so the months keep that order.
  const months = new Map<string, Memory[]>();
  for (const page of query.data?.pages ?? []) for (const memory of page.items) {
    const month = memory.memoryDate.slice(0, 7);
    const items = months.get(month);
    if (items) items.push(memory); else months.set(month, [memory]);
  }
  return <><PageHeader title="Memories" description="Photos and moments you share." action={<Link className="button primary" to="/memories/new">Add memory</Link>} />
    {query.isPending ? <><div className="visually-hidden"><Status>Loading memories…</Status></div><div className="memory-grid" aria-hidden="true">{[0, 1].map(index => <div key={index} className="card memory-card memory-placeholder"><div className="memory-cover" /><div className="memory-card-copy" /></div>)}</div></> : query.isError ? <><Status error>We could not load your memories.</Status><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></> : months.size ? [...months].map(([month, memories]) => <section className="memory-month" key={month}><h2>{formatDate(DateTime.fromISO(month + '-01'), 'month', account!.locale)}</h2><div className="memory-grid">{memories.map(memory => <MemoryCard key={memory.id} memory={memory} author={pair?.status === 'active' ? pair.members.find(member => member.userId === memory.createdBy) : undefined} locale={account!.locale} />)}</div></section>) : <section className="card"><h2>Your first memory</h2><p>Add a photo, a date, and a caption.</p><Link to="/memories/new">Add memory</Link></section>}
    {query.hasNextPage && <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load older memories</Button>}
  </>;
}
