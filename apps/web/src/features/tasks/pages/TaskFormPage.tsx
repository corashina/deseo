import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppError, toAppError } from '@deseo/domain/result';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { taskInputSchema, type Task } from '@deseo/domain/tasks';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
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
  const [params] = useSearchParams();
  if (!account || pair?.status !== 'active')
    throw new Error('Active pair required');
  const [id] = useState(() => task?.id ?? crypto.randomUUID());
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(task?.version);
  const form = useForm<Fields>({
    defaultValues: task ? fields(task) : { title: '', listId: lists.find(list => list.id === params.get('list'))?.id ?? lists.find(list => list.isGeneral)!.id, assigneeId: '', dueDate: '' }
  });
  const save = useMutation({ mutationFn: (values: Fields) => {
    const parsed = taskInputSchema.safeParse({ ...values, id, pairId: pair.pairId, assigneeId: values.assigneeId || null, dueDate: values.dueDate || null });
    if (!parsed.success) throw new AppError({ code: 'VALIDATION', message: parsed.error.issues[0].message });
    return task ? updateTask(parsed.data, version!) : createTask(parsed.data);
  } });
  const reload = useMutation({
    mutationFn: async () => {
      const current = await getTask(pair.pairId, task!.id);
      if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Task unavailable.' });
      form.reset(fields(current));
      setVersion(current.version);
    },
    onSuccess: () => save.reset(),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = failure?.code === 'CONFLICT';
  const error = reload.isError ? toAppError(reload.error).message : conflict ? 'This task changed. Your draft is kept.' : failure?.message ?? '';
  const saving = save.isPending || reload.isPending;
  useUnsavedChanges(!save.isSuccess && form.formState.isDirty);
  useEffect(() => {
    if (save.isSuccess)
      navigate('/tasks/' + id, { replace: true });
  }, [save.isSuccess, navigate, id]);
  return <>
    <PageHeader title={task ? 'Edit task' : 'Add task'} description="Choose a list, a person, and a due date." />
    <section className="card form-page">
      <form className="task-form" onSubmit={form.handleSubmit(values => save.mutate(values))}>
        <fieldset disabled={saving}>
          <label className="field">
            <span>Title</span>
            <input {...form.register('title')} maxLength={200} required autoFocus />
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
            <input type="date" {...form.register('dueDate')} />
          </label>
          </div>
        </fieldset>
        {error && <Status error>{error}
        </Status>}
        {conflict && <Button disabled={saving} variant="secondary" type="button" onClick={() => reload.mutate()}>Reload task and discard draft</Button>}
        <div className="actions">
          <Button type="submit" disabled={saving || conflict}>{saving ? 'Saving…' : failure ? 'Retry save' : task ? 'Save changes' : 'Save task'}
          </Button>
          <Link to="/tasks">Cancel</Link>
        </div>
      </form>
    </section>
  </>;
}
