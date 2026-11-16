import { RouteErrorPage } from '../../../../app/RouteErrorPage';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../../app/SessionProvider';
import { useReturnTo } from '../../../../lib/return-to';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Button } from '../../../../components/ui/Button';
import { Status } from '../../../../components/ui/Status';
import { Dialog } from '../../../../components/ui/Dialog';
import { getDateIdea, ideaKeys } from '../queries';
import { archiveIdea } from '../commands';
import '../../../../styles/calendar.css';
import '../../../../styles/planning.css';

const states = { saved: 'Saved', planned: 'Planned', archived: 'Archived' };

export function IdeaDetailPage() {
  const { ideaId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const back = useReturnTo('/ideas');
  const [confirm, setConfirm] = useState(false);
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId), queryFn: () => getDateIdea(pairId, ideaId), enabled: Boolean(pairId) });
  const archive = useMutation({ mutationFn: (version: number) => archiveIdea(ideaId, version), onSuccess: () => navigate(back), onError: () => void query.refetch(), onSettled: () => setConfirm(false) });
  const error = archive.isError ? toAppError(archive.error).code === 'CONFLICT'
    ? 'This idea changed. Review it before archiving.'
    : toAppError(archive.error).message : '';

  if (query.isPending) return <Status>Loading idea…</Status>;
  if (query.isError) return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" error={query.error} onRetry={() => void query.refetch()} />;
  const idea = query.data;
  if (!idea) return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  const from = { from: back };
  return <>
    <PageHeader eyebrow="Date idea" title={idea.title} description={states[idea.state]}
      action={<div className="actions">
        {idea.state !== 'archived' && <Link className="button secondary" to={'/ideas/' + idea.id + '/edit'} state={from}>Edit idea</Link>}
        {idea.state === 'saved' && <Link className="button primary" to={'/events/new?idea=' + idea.id}>Plan date</Link>}
      </div>} />
    <section className="card event-detail">
      {(idea.note || idea.link || idea.linkedEventId) && <dl>
        {idea.note && <><dt>Note</dt><dd>{idea.note}</dd></>}
        {idea.link && <><dt>Link</dt><dd><a href={idea.link} target="_blank" rel="noopener noreferrer">{idea.link}</a></dd></>}
        {idea.linkedEventId && <><dt>Planned</dt><dd><Link to={'/events/' + idea.linkedEventId}>View planned event</Link></dd></>}
      </dl>}
      {error && <Status error>{error}</Status>}
      <div className="actions">
        <Link to={back}>Return to ideas</Link>
        {idea.state !== 'archived' && <Button variant="secondary" disabled={archive.isPending} onClick={() => setConfirm(true)}>{archive.isError ? 'Retry archive' : 'Archive idea'}</Button>}
      </div>
    </section>
    <Dialog busy={archive.isPending} open={confirm} title="Archive this idea?" onClose={() => setConfirm(false)}>
      <p>You can find this idea in Archived.</p>
      <Button variant="primary" disabled={archive.isPending} onClick={() => archive.mutate(idea.version)}>Confirm archive</Button>
    </Dialog>
  </>;
}
