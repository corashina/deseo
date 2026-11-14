import { createTask } from '../commands';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { useNetworkStatus } from '../../../lib/network';
import type { TaskInput } from '@deseo/domain/tasks';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
        <QuickAdd key={listId} accountId={account!.id} pairId={pairId} listId={listId} />
        {tasks.isPending ? <Status>Loading tasks…</Status> : tasks.isError ? <>
          <Status error>We could not load tasks.</Status>
          <Button onClick={() => void tasks.refetch()}>Retry</Button>
        </> : tasks.data.length ? tasks.data.map(task => <TaskRow
          key={task.id}
          task={task}
          accountId={account!.id}
          timezone={pair.timezone}
          locale={account!.locale}
          assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />) : <p>No tasks in this list.</p>}
      </>}
    </section>
  </>;
}
type QuickDraft = {
  title: string;
  attempt?: {
    input: TaskInput;
    commandId: string;
  };
};
function QuickAdd({ accountId, pairId, listId }: {
  accountId: string;
  pairId: string;
  listId: string;
}) {
  const online = useNetworkStatus();
  const key = 'task-quick-add:' + listId;
  const saved = useRef(readDraft<QuickDraft>(accountId, pairId, key));
  const attempt = useRef(saved.current?.attempt);
  const [title, setTitle] = useState(saved.current?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(attempt.current));
  const [error, setError] = useState('');
  useUnsavedChanges(Boolean(title));
  const beginScope = useCommandScope(() => { setBusy(false); });
  async function add() {
    if (!online || busy)
      return;
    const next = attempt.current ?? { input: { id: crypto.randomUUID(), pairId, listId, title, assigneeId: null, dueDate: null }, commandId: crypto.randomUUID() };
    const scope = beginScope();
    attempt.current = next;
    writeDraft(accountId, pairId, key, { title, attempt: next });
    setBusy(true);
    setFrozen(true);
    const result = await createTask(next.input, next.commandId);
    if (!scope.isCurrent()) return;
    setBusy(false);
    if (result.ok) {
      attempt.current = undefined;
      removeDraft(accountId, pairId, key);
      setTitle('');
      setError('');
      setFrozen(false);
    }
    else {
      setError(result.error.message ?? 'Task save failed. Try again.');
      if (result.error.code !== 'RETRYABLE') {
        attempt.current = undefined;
        setFrozen(false);
        writeDraft(accountId, pairId, key, { title });
      }
    }
  }
  return <form className="quick-add" onSubmit={event => { event.preventDefault(); void add(); }}>
    <Field
      label="Quick add task"
      name="title"
      value={title}
      required
      maxLength={200}
      disabled={busy || frozen}
      onChange={event => {
        setTitle(event.target.value);
        writeDraft(accountId, pairId, key, { title: event.target.value });
      }} />
    <Button type="submit" disabled={!online || busy}>{busy ? 'Saving…' : frozen ? 'Retry task' : 'Add to list'}
    </Button>
    {error && <Status error>{error}
    </Status>}
  </form>;
}
