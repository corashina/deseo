import { useCalendarSignals } from '../../realtime';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../../../app/SessionProvider';
import { useNetworkStatus } from '../../../../lib/network';
import { captureQueryScope } from '../../../../lib/query-client';
import { readDraft, writeDraft, removeDraft } from '../../../../lib/drafts';
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
  const online = useNetworkStatus();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const key = 'idea-archive:' + ideaId;
  const attempt = useRef(readDraft<{
    version: number;
    commandId: string;
  }>(account!.id, pairId, key));
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useCalendarSignals(account!.id, pair);
  const query = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId), queryFn: () => getDateIdea(pairId, ideaId) });
  async function archive() {
    if (!online || saving || !query.data)
      return;
    const next = attempt.current ?? { version: query.data.version, commandId: crypto.randomUUID() };
    attempt.current = next;
    writeDraft(account!.id, pairId, key, next);
    const scope = captureQueryScope();
    setSaving(true);
    const result = await archiveIdea(ideaId, next.version, next.commandId);
    setSaving(false);
    setConfirm(false);
    try {
      scope.assertCurrent();
    }
    catch {
      setError('Archive is unconfirmed. Retry the same archive.');
      return;
    }
    if (result.ok) {
      removeDraft(account!.id, pairId, key);
      attempt.current = undefined;
      setError('');
    }
    else {
      setError(result.error.code === 'CONFLICT' ? 'This idea changed. Open it again before archiving.' : 'Archive failed. Try again.');
      if (result.error.code !== 'RETRYABLE') {
        attempt.current = undefined;
        removeDraft(account!.id, pairId, key);
      }
    }
  }
  if (query.isPending)
    return <Status>Loading idea…</Status>;
  if (query.isError)
    return <>
      <Status error>We could not load this idea.</Status>
      <Button onClick={() => void query.refetch()}>Retry</Button>
    </>;
  const idea = query.data;
  if (!idea)
    return <section className="card">
      <h1>Idea unavailable</h1>
      <Link to="/ideas">Return to ideas</Link>
    </section>;
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
        {idea.state !== 'archived' && <Button variant="secondary" disabled={!online || saving} onClick={() => setConfirm(true)}>Archive idea</Button>}
        <Link to="/ideas">Return to ideas</Link>
      </div>
      {error && <Status error>{error}
      </Status>}
      {attempt.current && !saving && <Button disabled={!online} onClick={() => void archive()}>Retry archive</Button>}
    </section>
    <Dialog open={confirm} title="Archive this idea?" onClose={() => setConfirm(false)}>
      <p>You can find this idea in Archived.</p>
      <Button disabled={!online || saving} onClick={() => void archive()}>Confirm archive</Button>
    </Dialog>
  </>;
}
