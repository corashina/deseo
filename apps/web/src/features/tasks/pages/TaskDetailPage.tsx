import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { ReminderControl } from '../../notifications';
import { useTaskSignals } from '../realtime';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
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
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const [confirm, setConfirm] = useState(false);
  useTaskSignals(account!.id, pair);
  const query = useQuery({ queryKey: taskKeys.task(account!.id, pairId, taskId), queryFn: () => getTask(pairId, taskId) });
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const remove = useMutation({ mutationFn: (version: number) => deleteTask(taskId, version), onSuccess: () => navigate('/tasks'), onError: () => void query.refetch(), onSettled: () => setConfirm(false) });
  const error = remove.isError ? toAppError(remove.error).code === 'CONFLICT' ? 'This task changed. Review it before deleting.' : toAppError(remove.error).message : '';
  if (query.isPending || lists.isPending)
    return <Status>Loading task…</Status>;
  if (query.isError || lists.isError)
    return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" error={query.error ?? lists.error} onRetry={() => { void query.refetch(); void lists.refetch(); }} />;
  const task = query.data;
  if (!task || pair?.status !== 'active')
    return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" />;
  return <>
    <PageHeader
      title={task.title}
      action={<Link className="button secondary" to={'/tasks/' + task.id + '/edit'}>Edit task</Link>} />
    <section className="card task-detail">
      <p>List: {lists.data?.find(list => list.id === task.listId)?.name ?? 'Loading…'}
      </p>
      <TaskRow
        task={task}
        timezone={pair.timezone}
        assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />
      <ReminderControl taskId={task.id} sourceVersion={task.version} timezone={pair.timezone} completed={Boolean(task.completedAt)} dueDate={task.dueDate} />
      <div className="actions">
        <Link to="/tasks">Return to tasks</Link>
        <Button variant="danger" disabled={remove.isPending} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete task'}</Button>
      </div>
      {error && <Status error>{error}
      </Status>}
    </section>
    <Dialog busy={remove.isPending} open={confirm} title="Delete this task?" onClose={() => setConfirm(false)}>
      <p>Both partners will lose this task.</p>
      <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(task.version)}>Confirm deletion</Button>
    </Dialog>
  </>;
}
