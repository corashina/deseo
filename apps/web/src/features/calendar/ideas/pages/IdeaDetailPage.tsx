import { RouteErrorPage } from '../../../../app/RouteErrorPage';
import { useCalendarSignals } from '../../realtime';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../../../app/SessionProvider';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Status } from '../../../../components/ui/Status';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { getDateIdea, ideaKeys } from '../queries';
import { archiveIdea } from '../commands';
import '../../../../styles/planning.css';
export function IdeaDetailPage() {
  const { ideaId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const [confirm, setConfirm] = useState(false);
  useCalendarSignals(account!.id, pair);
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId), queryFn: () => getDateIdea(pairId, ideaId) });
  const archive = useMutation({ mutationFn: (version: number) => archiveIdea(ideaId, version), onError: () => void query.refetch(), onSettled: () => setConfirm(false) });
  const error = archive.isError ? toAppError(archive.error).code === 'CONFLICT' ? 'This idea changed. Review it before archiving.' : toAppError(archive.error).message : '';
  if (query.isPending)
    return <Status>Loading idea…</Status>;
  if (query.isError)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" error={query.error} onRetry={() => void query.refetch()} />;
  const idea = query.data;
  if (!idea)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  return <>
    <PageHeader
      title={idea.title}
      action={<Link className="button secondary" to={'/ideas/' + idea.id + '/edit'}>Edit idea</Link>} />
    <section className="card">
      <p>{idea.state[0].toUpperCase() + idea.state.slice(1)}
      </p>
      {idea.note && <p className="preserve-lines">{idea.note}
      </p>}
      {idea.link && <p>
        <a href={idea.link} target="_blank" rel="noopener noreferrer">Open idea link</a>
      </p>}
      <div className="actions">{idea.state === 'saved' && <Link className="button primary" to={'/events/new?idea=' + idea.id}>Plan date</Link>}
        {idea.linkedEventId && <Link to={'/events/' + idea.linkedEventId}>View planned event</Link>}
        {idea.state !== 'archived' && <Button variant="secondary" disabled={archive.isPending} onClick={() => setConfirm(true)}>{archive.isError ? 'Retry archive' : 'Archive idea'}</Button>}
        <Link to="/ideas">Return to ideas</Link>
      </div>
      {error && <Status error>{error}
      </Status>}
    </section>
    <Dialog busy={archive.isPending} open={confirm} title="Archive this idea?" onClose={() => setConfirm(false)}>
      <p>You can find this idea in Archived.</p>
      <Button disabled={archive.isPending} onClick={() => archive.mutate(idea.version)}>Confirm archive</Button>
    </Dialog>
  </>;
}
