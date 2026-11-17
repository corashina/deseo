import { createList, createTask, deleteEmptyList, moveListTasksToGeneral, renameList } from '../commands';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { toAppError } from '@deseo/domain/result';
import type { Task, TaskList } from '@deseo/domain/tasks';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Status } from '../../../components/ui/Status';
import { Field } from '../../../components/ui/Field';
import { listTaskLists, listTasks, taskKeys } from '../queries';
import { TaskRow } from '../components/TaskRow';
import '../../../styles/planning.css';
export function TasksPage() {
  const { account, pair } = useSession();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const lists = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const list = lists.data?.find(list => list.id === params.get('list')) ?? lists.data?.find(list => list.isGeneral);
  const listId = list?.id ?? '';
  const tasks = useQuery({ queryKey: taskKeys.list(account!.id, pairId, listId), queryFn: () => listTasks(pairId, listId), enabled: Boolean(listId) });
  if (pair?.status !== 'active') return null;
  const select = (id: string) => { setAdding(false); setParams({ list: id }); };
  // Split open and done tasks in one pass.
  // Open tasks with a due date come first, soonest first. Tasks without one keep their order.
  const open: Task[] = [];
  const done: Task[] = [];
  for (const task of tasks.data ?? []) (task.completedAt === null ? open : done).push(task);
  open.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const row = (task: Task) => <TaskRow key={task.id} task={task} members={pair.members} timezone={account!.timezone} locale={account!.locale} />;
  return <>
    <PageHeader title="Tasks" hideTitle />
    <section className="card">
      {lists.isPending ? <Status>Loading lists…</Status> : lists.isError ? <>
        <Status error>We could not load lists.</Status>
        <Button variant="secondary" onClick={() => void lists.refetch()}>Retry</Button>
      </> : <>
        <div className="task-lists">
          <div className="view-tabs" role="group" aria-label="Task lists">{lists.data.map(item => <button key={item.id} title={item.name} aria-pressed={item.id === listId && !adding} onClick={() => select(item.id)}><span>{item.name}</span></button>)}</div>
          <Button variant="text" aria-pressed={adding} onClick={() => setAdding(true)}>New list</Button>
        </div>
        {adding ? <NewList pairId={pairId} onCreated={select} /> : <>
          <QuickAdd key={listId} pairId={pairId} listId={listId} />
          {tasks.isPending ? <Status>Loading tasks…</Status> : tasks.isError ? <>
            <Status error>We could not load tasks.</Status>
            <Button variant="secondary" onClick={() => void tasks.refetch()}>Retry</Button>
          </> : tasks.data.length ? <>
            {open.map(row)}
            {done.length > 0 && <details className="completed-tasks"><summary>Completed ({done.length})</summary>{done.map(row)}</details>}
          </> : <p className="muted">No tasks in this list yet.</p>}
          {list && !list.isGeneral && tasks.data && <ListSettings key={list.id} list={list} taskCount={tasks.data.length} onRemoved={() => select(lists.data.find(item => item.isGeneral)!.id)} />}
        </>}
      </>}
    </section>
  </>;
}
function QuickAdd({ pairId, listId }: { pairId: string; listId: string }) {
  const { pair } = useSession();
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  // The task ID belongs to the input, so a retry of the same input sends the same request.
  const [taskId, setTaskId] = useState(() => crypto.randomUUID());
  const command = useCommandId();
  const add = useMutation({
    mutationFn: () => {
      const input = { id: taskId, pairId, listId, title, assigneeId: assigneeId || null, dueDate: dueDate || null };
      return createTask(input, command.idFor(input));
    },
    onSuccess: () => { setTitle(''); setAssigneeId(''); setDueDate(''); setTaskId(crypto.randomUUID()); command.reset(); },
  });
  useUnsavedChanges(Boolean(title));
  if (pair?.status !== 'active') return null;
  // The frame measures the space the form has, so the layout follows the card width, not the window.
  return <div className="quick-add-frame"><form className="quick-add" onSubmit={event => { event.preventDefault(); if (!add.isPending) add.mutate(); }}>
    <Field label="New task" name="title" value={title} required maxLength={200} disabled={add.isPending} onChange={event => setTitle(event.target.value)} />
    <label className="field"><span>Assigned to</span><select name="assigneeId" value={assigneeId} disabled={add.isPending} onChange={event => setAssigneeId(event.target.value)}>
      <option value="">Unassigned</option>
      {pair.members.map(member => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
    </select></label>
    <Field label="Due date (optional)" name="dueDate" type="date" value={dueDate} disabled={add.isPending} onChange={event => setDueDate(event.target.value)} />
    <Button variant="primary" type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : add.isError ? 'Retry task' : 'Add task'}</Button>
    {add.isError && <Status error>{toAppError(add.error).message}</Status>}
  </form></div>;
}
function NewList({ pairId, onCreated }: { pairId: string; onCreated(id: string): void }) {
  const [name, setName] = useState('');
  const command = useCommandId();
  const add = useMutation({ mutationFn: () => createList(pairId, name, command.idFor({ pairId, name })), onSuccess: list => { command.reset(); onCreated(list.id); } });
  useUnsavedChanges(Boolean(name) && !add.isSuccess);
  return <form className="list-name-form" onSubmit={event => { event.preventDefault(); if (!add.isPending) add.mutate(); }}>
    <Field label="List name" name="listName" value={name} maxLength={40} required disabled={add.isPending} onChange={event => setName(event.target.value)} />
    <Button variant="primary" disabled={add.isPending} type="submit">{add.isPending ? 'Saving…' : add.isError ? 'Retry list' : 'Create list'}</Button>
    {add.isError && <Status error>{toAppError(add.error).message}</Status>}
  </form>;
}
function ListSettings({ list, taskCount, onRemoved }: { list: TaskList; taskCount: number; onRemoved(): void }) {
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  const command = useCommandId();
  const rename = useMutation({ mutationFn: () => renameList(list.id, name, list.version, command.idFor({ name, version: list.version })), onSuccess: () => { setName(''); command.reset(); } });
  // Move the tasks first. If the delete then fails, the list is empty and Retry removes it.
  const remove = useMutation({
    mutationFn: async () => { if (taskCount) await moveListTasksToGeneral(list.id); await deleteEmptyList(list.id); },
    onSuccess: onRemoved,
    onSettled: () => setConfirm(false),
  });
  useUnsavedChanges(Boolean(name));
  const busy = rename.isPending || remove.isPending;
  const failure = rename.error ?? remove.error;
  const error = failure ? toAppError(failure).code === 'CONFLICT' ? 'This list changed. Try again.' : toAppError(failure).message : '';
  return <details className="task-list-actions">
    <summary>List settings</summary>
    <form className="list-name-form" onSubmit={event => { event.preventDefault(); if (!busy) rename.mutate(); }}>
      <Field label="New list name" name="listName" value={name} maxLength={40} required disabled={busy} onChange={event => setName(event.target.value)} />
      <Button variant="primary" disabled={busy} type="submit">{rename.isError ? 'Retry rename' : 'Rename list'}</Button>
    </form>
    <div className="actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry removal' : 'Remove list'}</Button></div>
    {error && <Status error>{error}</Status>}
    <Dialog busy={remove.isPending} open={confirm} title="Remove this list?" onClose={() => setConfirm(false)}>
      <p>{taskCount ? 'Its tasks move to General. The list is removed for both partners.' : 'This empty list is removed for both partners.'}</p>
      <div className="actions"><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Confirm removal</Button>
      <Button variant="secondary" disabled={remove.isPending} onClick={() => setConfirm(false)}>Cancel</Button></div>
    </Dialog>
  </details>;
}
