import { ReminderControl } from '../../notifications';
import { useTaskSignals } from '../realtime';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { deleteTask } from '../commands';
import { TaskRow } from '../components/TaskRow';
import '../../../styles/planning.css';
export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const key = 'task-delete:' + taskId;
  const attempt = useRef(readDraft<{
    version: number;
    commandId: string;
  }>(account!.id, pairId, key));
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useTaskSignals(account!.id, pair);
  const query = useQuery({ queryKey: taskKeys.task(account!.id, pairId, taskId), queryFn: () => getTask(pairId, taskId) });
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  async function remove() {
    if (!online || saving || (!query.data && !attempt.current))
      return;
    const next = attempt.current ?? { version: query.data!.version, commandId: crypto.randomUUID() };
    attempt.current = next;
    writeDraft(account!.id, pairId, key, next);
    const scope = captureQueryScope();
    setSaving(true);
    const result = await deleteTask(taskId, next.version, next.commandId);
    setSaving(false);
    try {
      scope.assertCurrent();
    }
    catch {
      setError('Deletion is unconfirmed. Retry the same deletion.');
      return;
    }
    if (result.ok) {
      removeDraft(account!.id, pairId, key);
      navigate('/tasks');
      return;
    }
    setError(result.error.code === 'CONFLICT' ? 'This task changed. Open it again before deleting.' : 'Deletion failed. Try again.');
    if (result.error.code !== 'RETRYABLE') {
      attempt.current = undefined;
      removeDraft(account!.id, pairId, key);
    }
    setConfirm(false);
  }
  if (query.isPending)
    return <Status>Loading task…</Status>;
  if (query.isError)
    return <>
      <Status error>We could not load this task.</Status>
      <Button onClick={() => void query.refetch()}>Retry</Button>
    </>;
  const task = query.data;
  if (!task || pair?.status !== 'active')
    return <section className="card">
      <h1>Task unavailable</h1>
      {attempt.current && <Button disabled={!online || saving} onClick={() => void remove()}>Retry deletion</Button>}
      {error && <Status error>{error}
      </Status>}
      <Link to="/tasks">Return to tasks</Link>
    </section>;
  return <>
    <PageHeader
      title={task.title}
      action={<Link className="button secondary" to={'/tasks/' + task.id + '/edit'}>Edit task</Link>} />
    <section className="card">
      <p>List: {lists.data?.find(list => list.id === task.listId)?.name ?? 'Loading…'}
      </p>
      <TaskRow
        task={task}
        accountId={account!.id}
        assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />
      <ReminderControl taskId={task.id} sourceVersion={task.version} timezone={pair.timezone} completed={Boolean(task.completedAt)} dueDate={task.dueDate} />
      <div className="actions">
        <Link to="/tasks">Return to tasks</Link>
        <Button variant="danger" disabled={!online || saving} onClick={() => setConfirm(true)}>Delete task</Button>
      </div>
      {error && <Status error>{error}
      </Status>}
    </section>
    <Dialog open={confirm} title="Delete this task?" onClose={() => setConfirm(false)}>
      <p>Both partners will lose this task.</p>
      <Button variant="danger" disabled={!online || saving} onClick={() => void remove()}>Confirm deletion</Button>
    </Dialog>
  </>;
}
