import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useTaskSignals } from '../realtime';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { useCommandScope } from '../../../lib/use-command-scope';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { listTaskLists, listTasks, taskKeys } from '../queries';
import { renameList, moveListTasksToGeneral, deleteEmptyList } from '../commands';
import { TaskRow } from '../components/TaskRow';
import '../../../styles/planning.css';
type Draft = {
  name: string;
  attempt?: Attempt;
};
type Attempt = {
  kind: 'rename' | 'move' | 'remove';
  commandId: string;
  name: string;
  version: number;
};
export function ListDetailPage() {
  const { listId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const key = 'list-action:' + listId;
  const saved = useRef(readDraft<Draft>(account!.id, pairId, key));
  const attempt = useRef(saved.current?.attempt);
  const [name, setName] = useState(saved.current?.name ?? '');
  const [confirm, setConfirm] = useState<'move' | 'remove' | null>(null);
  const [saving, setSaving] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(saved.current?.attempt));
  const [error, setError] = useState('');
  const beginScope = useCommandScope(() => { setSaving(false); });
  useTaskSignals(account!.id, pair);
  const [removed, setRemoved] = useState(false);
  useUnsavedChanges(!removed && Boolean(name));
  useEffect(() => {
    if (removed)
      navigate('/tasks/lists');
  }, [removed, navigate]);
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const tasks = useQuery({ queryKey: taskKeys.list(account!.id, pairId, listId), queryFn: () => listTasks(pairId, listId) });
  const list = lists.data?.find(list => list.id === listId);
  async function run(kind: Attempt['kind']) {
    if (!online || saving || ((!list || list.isGeneral) && !attempt.current))
      return;
    const next = attempt.current ?? { kind, name, version: list!.version, commandId: crypto.randomUUID() };
    attempt.current = next;
    writeDraft(account!.id, pairId, key, { name, attempt: next });
    const scope = beginScope();
    setSaving(true);
    setFrozen(true);
    const result = next.kind === 'rename' ? await renameList(listId, next.name, next.version, next.commandId) : next.kind === 'move' ? await moveListTasksToGeneral(listId, next.commandId) : await deleteEmptyList(listId, next.commandId);
    if (!scope.isCurrent()) return;
    setSaving(false);
    setConfirm(null);
    if (result.ok) {
      attempt.current = undefined;
      removeDraft(account!.id, pairId, key);
      setFrozen(false);
      setError('');
      setName('');
      if (next.kind === 'remove')
        setRemoved(true);
    }
    else {
      setError(result.error.code === 'CONFLICT' ? 'This list changed. Reload before renaming.' : result.error.message ?? 'List change failed. Try again.');
      if (result.error.code !== 'RETRYABLE') {
        attempt.current = undefined;
        writeDraft(account!.id, pairId, key, { name });
        setFrozen(false);
      }
    }
  }
  if (lists.isPending || tasks.isPending)
    return <Status>Loading list…</Status>;
  if (lists.isError || tasks.isError)
    return <RouteErrorPage title="List" returnTo="/tasks/lists" returnLabel="Return to lists" error={lists.error ?? tasks.error} onRetry={() => { void lists.refetch(); void tasks.refetch(); }} />;
  if (!list || pair?.status !== 'active')
    return <RouteErrorPage title="List" returnTo="/tasks/lists" returnLabel="Return to lists">{attempt.current && <Button disabled={!online || saving} onClick={() => void run(attempt.current!.kind)}>Retry list change</Button>}
      {error && <Status error>{error}
      </Status>}</RouteErrorPage>;
  return <>
    <PageHeader
      title={list.name}
      description={list.isGeneral ? 'General cannot be renamed or removed.' : 'Move tasks to General before removing this list.'} />
    <section className="card planning-form">{tasks.data.length ? tasks.data.map(task => <TaskRow
      key={task.id}
      task={task}
      accountId={account!.id}
      assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />) : <p>No tasks in this list.</p>}
      {!list.isGeneral && <>
        <form onSubmit={event => { event.preventDefault(); void run('rename'); }}>
          <label className="field">
            <span>New list name</span>
            <input
              value={name}
              maxLength={40}
              required
              disabled={saving || frozen}
              onChange={event => {
                setName(event.target.value);
                writeDraft(account!.id, pairId, key, { name: event.target.value });
              }} />
          </label>
          <Button disabled={!online || saving || frozen} type="submit">Rename list</Button>
        </form>
        <div className="actions">
          <Button
            variant="secondary"
            disabled={!online || saving || frozen || !tasks.data.length}
            onClick={() => setConfirm('move')}>Move tasks to General</Button>
          <Button
            variant="danger"
            disabled={!online || saving || frozen || Boolean(tasks.data.length)}
            onClick={() => setConfirm('remove')}>Remove list</Button>
        </div>
      </>}
      {error && <Status error>{error}
      </Status>}
      {frozen && attempt.current && <Button disabled={!online || saving} onClick={() => void run(attempt.current!.kind)}>Retry list change</Button>}
      <p>
        <Link to="/tasks/lists">Return to lists</Link>
      </p>
    </section>
    <Dialog
      busy={saving}
      open={Boolean(confirm)}
      title={confirm === 'move' ? 'Move tasks to General?' : 'Remove this list?'}
      onClose={() => setConfirm(null)}>
      <p>{confirm === 'move' ? 'Both partners will find these tasks in General.' : 'This empty list will be removed for both partners.'}
      </p>
      <Button
        disabled={!online || saving}
        variant={confirm === 'remove' ? 'danger' : 'primary'}
        onClick={() => void run(confirm!)}>{confirm === 'move' ? 'Confirm move' : 'Confirm removal'}
      </Button>
    </Dialog>
  </>;
}
