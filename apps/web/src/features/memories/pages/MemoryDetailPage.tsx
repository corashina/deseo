import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { getMemory, memoryKeys, useMemorySignals } from '../queries';
import { deleteMemory } from '../commands';
import { MemoryImage } from '../components/MemoryImage';
import { loadMemoryPhoto } from '../media';
import '../../../styles/memories.css';
export function MemoryDetailPage() {
  const { memoryId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const navigate = useNavigate(); const online = useNetworkStatus();
  const mounted = useRef(false); const busy = useRef(false);
  const scopeCleanup = useRef<() => void>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scopeCleanup.current?.(); }; }, []);
  const key = 'memory-delete:' + memoryId;
  const attempt = useRef(readDraft<{ version: number; commandId: string }>(account!.id, pairId, key));
  const [confirm, setConfirm] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useMemorySignals(account!.id, pair);
  const query = useQuery({ queryKey: memoryKeys.detail(account!.id, pairId, memoryId), queryFn: () => getMemory(pairId, memoryId), retry: false });
  function beginScope() {
    scopeCleanup.current?.();
    const scope = captureQueryScope();
    const unlock = () => { if (mounted.current) { busy.current = false; setSaving(false); } };
    scope.signal.addEventListener('abort', unlock, { once: true });
    scopeCleanup.current = () => scope.signal.removeEventListener('abort', unlock);
    return scope;
  }
  async function remove() {
    if (!online || busy.current || (!query.data && !attempt.current)) return;
    const next = attempt.current ?? { version: query.data!.version, commandId: crypto.randomUUID() };
    attempt.current = next; writeDraft(account!.id, pairId, key, next);
    const scope = beginScope(); busy.current = true; setSaving(true);
    const result = await deleteMemory(memoryId, next.version, next.commandId);
    if (!mounted.current || scope.signal.aborted) return;
    busy.current = false; setSaving(false); setConfirm(false);
    if (result.ok) { removeDraft(account!.id, pairId, key); navigate('/memories'); return; }
    setError(result.error.code === 'CONFLICT' ? 'This memory changed. Open it again before deleting.' : 'Deletion failed. Try again.');
    if (result.error.code !== 'RETRYABLE') { attempt.current = undefined; removeDraft(account!.id, pairId, key); }
  }
  async function download(photoId: string, index: number) {
    if (!online || busy.current) return;
    const scope = beginScope(); busy.current = true; setSaving(true); setError('');
    try {
      const blob = await loadMemoryPhoto(photoId, 'full', scope.signal);
      scope.assertCurrent(); if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'deseo-memory-' + memoryId + '-' + (index + 1) + '.jpg'; anchor.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch { if (mounted.current && !scope.signal.aborted) setError('We could not download this photo. Try again.'); }
    finally { if (mounted.current && !scope.signal.aborted) { busy.current = false; setSaving(false); } }
  }
  if (query.isPending) return <Status>Loading memory…</Status>;
  if (query.isError || !query.data || query.data.state !== 'published') return <section className="card"><h1>Memory unavailable</h1><p>You may no longer have access to this memory.</p>{attempt.current && <Button disabled={!online || saving} onClick={() => void remove()}>Retry deletion</Button>}<Link to="/memories">Return to memories</Link>{error && <Status error>{error}</Status>}</section>;
  const memory = query.data; const author = memory.createdBy === account!.id;
  return <><PageHeader title={memory.caption || 'Our memory'} description={DateTime.fromISO(memory.memoryDate).setLocale('en').toFormat('d LLLL yyyy') + ' · ' + (pair?.status === 'active' ? pair.members.find(member => member.userId === memory.createdBy)!.displayName : '')} action={author ? <Link className="button secondary" to={'/memories/' + memoryId + '/edit'}>Edit memory</Link> : undefined} />
    <section className="card memory-detail">{memory.photos.map((photo, index) => <figure key={photo.id}><MemoryImage photoId={photo.id} variant="full" alt={(memory.caption || 'Shared memory') + ' · Photo ' + (index + 1)} /><figcaption><Button variant="secondary" disabled={!online || saving} onClick={() => void download(photo.id, index)}>Download photo {index + 1}</Button></figcaption></figure>)}
      <div className="actions"><Link to="/memories">Return to memories</Link>{author && <Button variant="danger" disabled={!online || saving} onClick={() => setConfirm(true)}>Delete memory</Button>}</div>{error && <Status error>{error}</Status>}
    </section><Dialog open={confirm} title="Delete this memory?" onClose={() => setConfirm(false)}><p>Both partners will lose this memory and its photos.</p><Button variant="danger" disabled={!online || saving} onClick={() => void remove()}>Confirm deletion</Button></Dialog>
  </>;
}
