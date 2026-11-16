import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useCommandId } from '../../../lib/command-id';
import { queryClient } from '../../../lib/query-client';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { Dialog } from '../../../components/ui/Dialog';
import { getMemory, memoryKeys } from '../queries';
import { deleteMemory } from '../commands';
import { MemoryImage } from '../components/MemoryImage';
import { memoryPhotoQuery } from '../media';
import '../../../styles/memories.css';
export function MemoryDetailPage() {
  const { memoryId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const command = useCommandId();
  const query = useQuery({ queryKey: memoryKeys.detail(account!.id, pairId, memoryId), queryFn: () => getMemory(pairId, memoryId), retry: false });
  const remove = useMutation({
    mutationFn: (version: number) => deleteMemory(memoryId, version, command.idFor({ memoryId, version })),
    onSuccess: () => { command.reset(); navigate('/memories'); },
    onError: () => void query.refetch(),
    onSettled: () => setConfirm(false),
  });
  // The photo on this page is in the query cache already, so a download reads no new bytes.
  const download = useMutation({ mutationFn: async ({ path, index }: { path: string; index: number }) => {
    const blob = await queryClient.fetchQuery(memoryPhotoQuery(account!.id, pairId, path));
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'deseo-memory-' + memoryId + '-' + (index + 1) + '.jpg'; anchor.click();
    } finally { URL.revokeObjectURL(url); }
  } });
  const busy = remove.isPending || download.isPending;
  const error = remove.isError ? toAppError(remove.error).code === 'CONFLICT' ? 'This memory changed. Review it before deleting.' : toAppError(remove.error).message
    : download.isError ? 'We could not download this photo. Try again.' : '';
  if (query.isPending) return <Status>Loading memory…</Status>;
  if (query.isError) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.state !== 'published') return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" />;
  const memory = query.data; const author = memory.createdBy === account!.id;
  return <><PageHeader title={memory.caption || 'Our memory'} description={formatDate(DateTime.fromISO(memory.memoryDate), 'date', account!.locale) + ' · ' + (pair?.status === 'active' ? pair.members.find(member => member.userId === memory.createdBy)!.displayName : '')} action={author ? <Link className="button secondary" to={'/memories/' + memoryId + '/edit'}>Edit memory</Link> : undefined} />
    <section className="card memory-detail">{memory.photos.map((photo, index) => <figure key={photo.id}><MemoryImage photo={photo} variant="full" alt={(memory.caption || 'Shared memory') + ' · Photo ' + (index + 1)} /><figcaption><Button variant="secondary" disabled={busy} onClick={() => download.mutate({ path: photo.fullPath, index })}>Download photo {index + 1}</Button></figcaption></figure>)}
      <div className="actions"><Link to="/memories">Return to memories</Link>{author && <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete memory'}</Button>}</div>{error && <Status error>{error}</Status>}
    </section><Dialog busy={remove.isPending} open={confirm} title="Delete this memory?" onClose={() => setConfirm(false)}><p>Both partners will lose this memory and its photos.</p><Button variant="danger" disabled={busy} onClick={() => remove.mutate(memory.version)}>Confirm deletion</Button></Dialog>
  </>;
}
