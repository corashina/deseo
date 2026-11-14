import { createTask } from '../commands';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { toAppError } from '@deseo/domain/result';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useTaskSignals } from '../realtime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Field } from '../../../components/ui/Field';
import { listTaskLists, listTasks, taskKeys } from '../queries';
import { TaskRow } from '../components/TaskRow';
import '../../../styles/planning.css';
export function TasksPage() {
  const { account, pair } = useSession();
  const [params, setParams] = useSearchParams();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const listId = lists.data?.find(list => list.id === params.get('list'))?.id ?? lists.data?.find(list => list.isGeneral)?.id ?? '';
  const tasks = useQuery({ queryKey: taskKeys.list(account!.id, pairId, listId), queryFn: () => listTasks(pairId, listId), enabled: Boolean(listId) });
  useTaskSignals(account!.id, pair);
  if (pair?.status !== 'active')
    return null;
  return <>
    <PageHeader
      title="Tasks"
      description="Keep shared tasks in named lists."
      action={<Link className="button primary" to={'/tasks/new?list=' + listId}>Add task</Link>} />
    <section className="card">
      <div className="section-heading">
        <h2>Your lists</h2>
        <Link className="task-details" to="/tasks/lists">Manage lists</Link>
      </div>
      {lists.isPending ? <Status>Loading lists…</Status> : lists.isError ? <>
        <Status error>We could not load lists.</Status>
        <Button onClick={() => void lists.refetch()}>Retry</Button>
      </> : <>
        <div className="view-tabs">{lists.data.map(list => <button key={list.id} aria-pressed={list.id === listId} onClick={() => setParams({ list: list.id })}>{list.name}
        </button>)}
        </div>
        <QuickAdd key={listId} pairId={pairId} listId={listId} />
        {tasks.isPending ? <Status>Loading tasks…</Status> : tasks.isError ? <>
          <Status error>We could not load tasks.</Status>
          <Button onClick={() => void tasks.refetch()}>Retry</Button>
        </> : tasks.data.length ? tasks.data.map(task => <TaskRow
          key={task.id}
          task={task}
          timezone={pair.timezone}
          locale={account!.locale}
          assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />) : <p>No tasks in this list.</p>}
      </>}
    </section>
  </>;
}
function QuickAdd({ pairId, listId }: {
  pairId: string;
  listId: string;
}) {
  const [title, setTitle] = useState('');
  // The task ID belongs to the input, so a retry of the same title sends the same request.
  const [taskId, setTaskId] = useState(() => crypto.randomUUID());
  const command = useCommandId();
  const add = useMutation({
    mutationFn: () => {
      const input = { id: taskId, pairId, listId, title, assigneeId: null, dueDate: null };
      return createTask(input, command.idFor(input));
    },
    onSuccess: () => { setTitle(''); setTaskId(crypto.randomUUID()); command.reset(); },
  });
  useUnsavedChanges(Boolean(title));
  return <form className="quick-add" onSubmit={event => { event.preventDefault(); if (!add.isPending) add.mutate(); }}>
    <Field
      label="Quick add task"
      name="title"
      value={title}
      required
      maxLength={200}
      disabled={add.isPending}
      onChange={event => setTitle(event.target.value)} />
    <Button type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : add.isError ? 'Retry task' : 'Add to list'}
    </Button>
    {add.isError && <Status error>{toAppError(add.error).message}
    </Status>}
  </form>;
}
