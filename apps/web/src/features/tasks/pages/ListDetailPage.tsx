import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useTaskSignals } from '../realtime';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { listTaskLists, listTasks, taskKeys } from '../queries';
import { renameList, moveListTasksToGeneral, deleteEmptyList } from '../commands';
import { TaskRow } from '../components/TaskRow';
import '../../../styles/planning.css';
export function ListDetailPage() {
  const { listId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<'move' | 'remove' | null>(null);
  useTaskSignals(account!.id, pair);
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const tasks = useQuery({ queryKey: taskKeys.list(account!.id, pairId, listId), queryFn: () => listTasks(pairId, listId) });
  const list = lists.data?.find(list => list.id === listId);
  const change = useMutation({
    mutationFn: (kind: 'rename' | 'move' | 'remove') => kind === 'rename' ? renameList(listId, name, list!.version) : kind === 'move' ? moveListTasksToGeneral(listId) : deleteEmptyList(listId),
    onSuccess: () => setName(''),
    onSettled: () => setConfirm(null),
  });
  const saving = change.isPending;
  const error = change.isError ? toAppError(change.error).code === 'CONFLICT' ? 'This list changed. Try again.' : toAppError(change.error).message : '';
  const removed = change.isSuccess && change.variables === 'remove';
  useUnsavedChanges(!removed && Boolean(name));
  useEffect(() => { if (removed) navigate('/tasks/lists'); }, [removed, navigate]);
  if (lists.isPending || tasks.isPending)
    return <Status>Loading list…</Status>;
  if (lists.isError || tasks.isError)
    return <RouteErrorPage title="List" returnTo="/tasks/lists" returnLabel="Return to lists" error={lists.error ?? tasks.error} onRetry={() => { void lists.refetch(); void tasks.refetch(); }} />;
  if (!list || pair?.status !== 'active')
    return <RouteErrorPage title="List" returnTo="/tasks/lists" returnLabel="Return to lists" />;
  return <>
    <PageHeader
      title={list.name}
      description={list.isGeneral ? 'General cannot be renamed or removed.' : 'Move tasks to General before removing this list.'} />
    <section className="card task-detail">{tasks.data.length ? tasks.data.map(task => <TaskRow
      key={task.id}
      task={task}
      timezone={pair.timezone}
      assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />) : <p>No tasks in this list.</p>}
      {!list.isGeneral && <div className="task-list-actions">
        <h2>List settings</h2>
        <form className="list-name-form" onSubmit={event => { event.preventDefault(); if (!saving) change.mutate('rename'); }}>
          <label className="field">
            <span>New list name</span>
            <input
              value={name}
              maxLength={40}
              required
              disabled={saving}
              onChange={event => setName(event.target.value)} />
          </label>
          <Button disabled={saving} type="submit">Rename list</Button>
        </form>
        <div className="actions">
          <Button
            variant="secondary"
            disabled={saving || !tasks.data.length}
            onClick={() => setConfirm('move')}>Move tasks to General</Button>
          <Button
            variant="danger"
            disabled={saving || Boolean(tasks.data.length)}
            onClick={() => setConfirm('remove')}>Remove list</Button>
        </div>
      </div>}
      {error && <Status error>{error}
      </Status>}
      {change.isError && <Button disabled={saving} onClick={() => change.mutate(change.variables!)}>Retry list change</Button>}
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
        disabled={saving}
        variant={confirm === 'remove' ? 'danger' : 'primary'}
        onClick={() => change.mutate(confirm!)}>{confirm === 'move' ? 'Confirm move' : 'Confirm removal'}
      </Button>
    </Dialog>
  </>;
}
