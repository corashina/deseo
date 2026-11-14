import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { taskInputSchema, type Task, type TaskInput } from '@deseo/domain/tasks';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { useNetworkStatus } from '../../../lib/network';
import { finePointer } from '../../../lib/pointer';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { createTask, updateTask } from '../commands';
import '../../../styles/planning.css';
type Fields = {
  title: string;
  listId: string;
  assigneeId: string;
  dueDate: string;
};
type Attempt = {
  input: TaskInput;
  commandId: string;
  expectedVersion?: number;
};
type Draft = {
  values: Fields;
  id: string;
  expectedVersion?: number;
  attempt?: Attempt;
  dirty: boolean;
};
const fields = (task: Task): Fields => ({ title: task.title, listId: task.listId, assigneeId: task.assigneeId ?? '', dueDate: task.dueDate ?? '' });
export function TaskFormPage() {
  const { taskId } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: taskKeys.task(account!.id, pairId, taskId ?? 'new'), queryFn: () => getTask(pairId, taskId!), enabled: Boolean(taskId) });
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  if (lists.isPending || (taskId && query.isPending))
    return <Status>Loading task…</Status>;
  if (lists.isError || query.isError)
    return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" error={(lists.isError ? lists : query).error} onRetry={() => { void query.refetch(); void lists.refetch(); }} />;
  if (taskId && !query.data)
    return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" />;
  return <TaskEditor key={taskId ?? 'new'} task={query.data ?? undefined} lists={lists.data} />;
}
function TaskEditor({ task, lists }: {
  task?: Task;
  lists: Awaited<ReturnType<typeof listTaskLists>>;
}) {
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const [params] = useSearchParams();
  if (!account || pair?.status !== 'active')
    throw new Error('Active pair required');
  const key = 'task:' + (task?.id ?? 'new');
  const draft = useRef(readDraft<Draft>(account.id, pair.pairId, key));
  const id = useRef(draft.current?.id ?? task?.id ?? crypto.randomUUID());
  const version = useRef(draft.current?.expectedVersion ?? task?.version);
  const attempt = useRef(draft.current?.attempt);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(attempt.current));
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const beginScope = useCommandScope(() => { busy.current = false; setSaving(false); });
  const form = useForm<Fields>({
    defaultValues: draft.current?.values ?? (task ? fields(task) : { title: '', listId: lists.find(list => list.id === params.get('list'))?.id ?? lists.find(list => list.isGeneral)!.id, assigneeId: '', dueDate: '' })
  });
  useUnsavedChanges(!confirmed && (form.formState.isDirty || draft.current?.dirty === true || frozen));
  useEffect(() => {
    const watch = form.watch(values => writeDraft(account.id, pair.pairId, key, { values, id: id.current, expectedVersion: version.current, attempt: attempt.current, dirty: true }));
    return () => watch.unsubscribe();
  }, [form, account.id, pair.pairId, key]);
  useEffect(() => {
    if (confirmed)
      navigate('/tasks/' + id.current, { replace: true });
  }, [confirmed, navigate]);
  async function save(values: Fields) {
    if (!online || busy.current)
      return;
    const parsed = taskInputSchema.safeParse({ ...values, id: id.current, pairId: pair!.status === 'active' ? pair!.pairId : '', assigneeId: values.assigneeId || null, dueDate: values.dueDate || null });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const next = attempt.current ?? { input: parsed.data, commandId: crypto.randomUUID(), expectedVersion: version.current };
    const scope = beginScope();
    attempt.current = next;
    busy.current = true;
    setSaving(true);
    setFrozen(true);
    setError('');
    writeDraft(account!.id, next.input.pairId, key, { values, id: id.current, expectedVersion: version.current, attempt: next, dirty: true });
    const result = task ? await updateTask(next.input.id, next.input, next.expectedVersion!, next.commandId) : await createTask(next.input, next.commandId);
    if (!scope.isCurrent()) return;
    busy.current = false;
    setSaving(false);
    if (result.ok) {
      removeDraft(account!.id, next.input.pairId, key);
      setConfirmed(true);
      return;
    }
    setError(result.error.code === 'CONFLICT' ? 'This task changed. Your draft is kept.' : result.error.message ?? 'Save failed. Try again.');
    setConflict(result.error.code === 'CONFLICT');
    if (result.error.code !== 'RETRYABLE') {
      attempt.current = undefined;
      setFrozen(false);
      writeDraft(account!.id, next.input.pairId, key, { values, id: id.current, expectedVersion: version.current, dirty: true });
    }
  }
  async function reload() {
    if (saving)
      return;
    const scope = beginScope();
    setSaving(true);
    try {
      const current = await getTask(pair!.status === 'active' ? pair!.pairId : '', task!.id);
      if (!scope.isCurrent()) return;
      if (!current) {
        setError('Task unavailable.');
        return;
      }
      version.current = current.version;
      attempt.current = undefined;
      draft.current = undefined;
      form.reset(fields(current));
      removeDraft(account!.id, current.pairId, key);
      setConflict(false);
      setError('');
    }
    catch {
      if (!scope.isCurrent()) return;
      setError('We could not reload this task. Try again.');
    }
    finally {
      if (scope.isCurrent()) setSaving(false);
    }
  }
  return <>
    <PageHeader title={task ? 'Edit task' : 'Add task'} description="Choose a list, a person, and a due date." />
    <section className="card form-page">
      <form className="task-form" onSubmit={form.handleSubmit(save)}>
        <fieldset disabled={saving || frozen}>
          <label className="field">
            <span>Title</span>
            <input {...form.register('title')} autoComplete="off" maxLength={200} required autoFocus={finePointer} />
          </label>
          <div className="task-form-group">
          <h2>Assignment and due date</h2>
          <label className="field">
            <span>List</span>
            <select {...form.register('listId')}>{lists.map(list => <option key={list.id} value={list.id}>{list.name}
            </option>)}
            </select>
          </label>
          <label className="field">
            <span>Assigned to</span>
            <select {...form.register('assigneeId')}>
              <option value="">Unassigned</option>
              {pair.members.map(member => <option key={member.userId} value={member.userId}>{member.displayName}
              </option>)}
            </select>
          </label>
          <label className="field">
            <span>Due date (optional)</span>
            <input type="date" autoComplete="off" {...form.register('dueDate')} />
          </label>
          </div>
        </fieldset>
        {error && <Status error>{error}
        </Status>}
        {frozen && <p>Your save is unconfirmed. Retry with the same details.</p>}
        {conflict && <Button disabled={!online || saving} variant="secondary" type="button" onClick={() => void reload()}>Reload task and discard draft</Button>}
        <div className="actions">
          <Button type="submit" disabled={!online || saving || conflict}>{saving ? 'Saving…' : frozen ? 'Retry save' : task ? 'Save changes' : 'Save task'}
          </Button>
          <Link to="/tasks">Cancel</Link>
        </div>
      </form>
    </section>
  </>;
}
