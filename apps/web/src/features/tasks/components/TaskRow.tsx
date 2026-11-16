import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import type { Task } from '@deseo/domain/tasks';
import { toAppError } from '@deseo/domain/result';
import { setTaskCompleted } from '../commands';
import { invalidate } from '../../../lib/query-keys';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
export function TaskRow({ task, assignee, timezone, locale }: {
  task: Task;
  assignee: string;
  timezone: string;
  locale: string;
}) {
  // A failure refreshes the task, so a retry uses its current version.
  const completion = useMutation({ mutationFn: (completed: boolean) => setTaskCompleted(task.id, completed, task.version),
    onError: () => void invalidate(['tasks'], ['today']) });
  const completed = completion.isPending ? completion.variables : task.completedAt !== null;
  const due = task.dueDate ? DateTime.fromISO(task.dueDate, { zone: timezone }) : null;
  const today = DateTime.now().setZone(timezone).startOf('day');
  const dueLabel = due ? (due.hasSame(today, 'day') ? 'Due today' : due.hasSame(today.plus({ days: 1 }), 'day') ? 'Due tomorrow' : !completed && due < today ? 'Overdue' : 'Due') + ' · ' + formatDate(due, due.year === today.year ? 'day' : 'dayYear', locale) : '';
  const error = completion.isError ? toAppError(completion.error).code === 'CONFLICT' ? 'This task changed. Review it and try again.' : 'Completion failed. Try again.' : '';
  return <article className={'task-row' + (completed ? ' task-completed' : '')}>
    <div className="task-row-main">
      <label className="task-check">
        <input
          type="checkbox"
          aria-label={'Complete ' + task.title}
          checked={completed}
          disabled={completion.isPending}
          onChange={event => completion.mutate(event.target.checked)} />
        <span className="task-row-content">
          <span className="task-title">{task.title}</span>
          <span className="task-metadata"><span>{assignee}</span>{task.dueDate && <time dateTime={task.dueDate}>{dueLabel}</time>}</span>
        </span>
      </label>
      <Link className="task-details" aria-label={'Edit ' + task.title} to={'/tasks/' + task.id}>Edit</Link>
    </div>
    {error && <Status error>{error}</Status>}
    {completion.isError && <Button variant="secondary" onClick={() => completion.mutate(completion.variables!)}>Retry completion</Button>}
  </article>;
}
