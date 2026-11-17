import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import type { Task } from '@deseo/domain/tasks';
import type { PairMember } from '@deseo/domain/pair';
import { toAppError } from '@deseo/domain/result';
import { setTaskCompleted } from '../commands';
import { invalidate } from '../../../lib/query-keys';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PartnerBadge } from '../../../components/ui/PartnerBadge';
import { formatDate } from '../../../lib/format';
// The checkbox completes the task. The rest of the row opens the task to edit it.
export function TaskRow({ task, members, timezone, locale }: {
  task: Task;
  members: readonly PairMember[];
  timezone: string;
  locale: string;
}) {
  // A failure refreshes the task, so a retry uses its current version.
  const completion = useMutation({ mutationFn: (completed: boolean) => setTaskCompleted(task.id, completed, task.version),
    onError: () => void invalidate(['tasks'], ['today']) });
  const completed = completion.isPending ? completion.variables : task.completedAt !== null;
  const assignee = members.find(member => member.userId === task.assigneeId);
  const completedBy = completed ? members.find(member => member.userId === task.completedBy) : undefined;
  const due = task.dueDate ? DateTime.fromISO(task.dueDate, { zone: timezone }) : null;
  const today = DateTime.now().setZone(timezone).startOf('day');
  const urgency = !due || completed ? '' : due < today ? 'overdue' : due.hasSame(today, 'day') ? 'due-today' : '';
  const dueLabel = due ? (due.hasSame(today, 'day') ? 'Due today' : due.hasSame(today.plus({ days: 1 }), 'day') ? 'Due tomorrow' : urgency === 'overdue' ? 'Overdue' : 'Due') + ' · ' + formatDate(due, due.year === today.year ? 'day' : 'dayYear', locale) : '';
  const error = completion.isError ? toAppError(completion.error).code === 'CONFLICT' ? 'This task changed. Review it.' : 'We could not update this task. Try again.' : '';
  return <article className={'task-row' + (completed ? ' task-completed' : '')}>
    <div className="task-row-main">
      <label className="task-check">
        <input
          type="checkbox"
          aria-label={'Complete ' + task.title}
          checked={completed}
          disabled={completion.isPending}
          onChange={event => completion.mutate(event.target.checked)} />
      </label>
      <Link className="task-row-content" to={'/tasks/' + task.id}>
        <span className="task-title">{task.title}</span>
        <span className="task-metadata">
          {assignee ? <PartnerBadge name={assignee.displayName} slot={assignee.slot} /> : <span>Unassigned</span>}
          {task.dueDate && <time className={urgency} dateTime={task.dueDate}>{dueLabel}</time>}
          {completedBy && <span>Done by {completedBy.displayName}</span>}
        </span>
      </Link>
    </div>
    {error && <div className="task-error"><Status error>{error}</Status>{completion.isError && <Button variant="secondary" onClick={() => completion.mutate(completion.variables!)}>Retry completion</Button>}</div>}
  </article>;
}
