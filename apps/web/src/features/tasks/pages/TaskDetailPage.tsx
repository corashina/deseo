import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppError, toAppError } from '@deseo/domain/result';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { taskInputSchema, type Task, type TaskList } from '@deseo/domain/tasks';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Status } from '../../../components/ui/Status';
import { getTask, listTaskLists, taskKeys } from '../queries';
import { deleteTask, updateTask } from '../commands';
import '../../../styles/planning.css';
type Fields = { title: string; listId: string; assigneeId: string; dueDate: string };
const fields = (task: Task): Fields => ({ title: task.title, listId: task.listId, assigneeId: task.assigneeId ?? '', dueDate: task.dueDate ?? '' });
// Opening a task shows its edit form. Tasks are short, so no read-only view comes first.
export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: taskKeys.task(account!.id, pairId, taskId), queryFn: () => getTask(pairId, taskId) });
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  if (query.isPending || lists.isPending) return <Status>Loading task…</Status>;
  if (query.isError || lists.isError)
    return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" error={query.error ?? lists.error} onRetry={() => { void query.refetch(); void lists.refetch(); }} />;
  if (!query.data || pair?.status !== 'active') return <RouteErrorPage title="Task" returnTo="/tasks" returnLabel="Return to tasks" />;
  return <TaskEditor key={taskId} task={query.data} lists={lists.data} />;
}
function TaskEditor({ task, lists }: { task: Task; lists: TaskList[] }) {
  const { pair } = useSession();
  const navigate = useNavigate();
  if (pair?.status !== 'active') throw new Error('Active pair required');
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(task.version);
  const [confirm, setConfirm] = useState(false);
  const command = useCommandId();
  const form = useForm<Fields>({ defaultValues: fields(task) });
  const save = useMutation({ mutationFn: (values: Fields) => {
    const parsed = taskInputSchema.safeParse({ ...values, id: task.id, pairId: pair.pairId, assigneeId: values.assigneeId || null, dueDate: values.dueDate || null });
    if (!parsed.success) throw new AppError({ code: 'VALIDATION', message: parsed.error.issues[0].message });
    return updateTask(parsed.data, version, command.idFor({ input: parsed.data, version }));
  }, onSuccess: () => command.reset() });
  const reload = useMutation({
    mutationFn: async () => {
      const current = await getTask(pair.pairId, task.id);
      if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Task unavailable.' });
      form.reset(fields(current));
      setVersion(current.version);
    },
    onSuccess: () => save.reset(),
  });
  const remove = useMutation({ mutationFn: () => deleteTask(task.id, version), onSuccess: () => navigate('/tasks?list=' + task.listId), onSettled: () => setConfirm(false) });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = failure?.code === 'CONFLICT' || (remove.isError && toAppError(remove.error).code === 'CONFLICT');
  const error = reload.isError ? toAppError(reload.error).message : conflict ? 'This task changed. Your draft is kept.'
    : failure?.message ?? (remove.isError ? toAppError(remove.error).message : '');
  const saving = save.isPending || reload.isPending || remove.isPending;
  useUnsavedChanges(!save.isSuccess && form.formState.isDirty);
  useEffect(() => {
    if (save.data) navigate('/tasks?list=' + save.data.listId, { replace: true });
  }, [save.data, navigate]);
  return <>
    <PageHeader title="Edit task" />
    <section className="card form-page">
      <form className="task-form" onSubmit={form.handleSubmit(values => save.mutate(values))}>
        <fieldset disabled={saving}>
          {/* A long title wraps. Enter saves, because a title has one line of text. */}
          <label className="field"><span>Title</span><textarea {...form.register('title')} autoComplete="off" maxLength={200} rows={2} required
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /></label>
          <label className="field"><span>List</span><select {...form.register('listId')}>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
          <label className="field"><span>Assigned to</span><select {...form.register('assigneeId')}>
            <option value="">Unassigned</option>
            {pair.members.map(member => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
          </select></label>
          <label className="field"><span>Due date (optional)</span><input type="date" autoComplete="off" {...form.register('dueDate')} /></label>
        </fieldset>
        {error && <Status error>{error}</Status>}
        {conflict && <Button disabled={saving} variant="secondary" type="button" onClick={() => { remove.reset(); reload.mutate(); }}>Reload task and discard draft</Button>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={saving || conflict}>{save.isPending ? 'Saving…' : failure ? 'Retry save' : 'Save changes'}</Button>
          <Link className="button secondary" to={'/tasks?list=' + task.listId}>Cancel</Link>
        </div>
      </form>
      <div className="form-delete"><Button variant="secondary" disabled={saving} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete task'}</Button></div>
    </section>
    <Dialog busy={remove.isPending} open={confirm} title="Delete this task?" onClose={() => setConfirm(false)}>
      <p>Both partners will lose this task.</p>
      <div className="actions"><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Confirm deletion</Button>
      <Button variant="secondary" disabled={remove.isPending} onClick={() => setConfirm(false)}>Cancel</Button></div>
    </Dialog>
  </>;
}
