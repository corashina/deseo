import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '@deseo/domain/tasks';
import { setTaskCompleted } from '../commands';
import { useNetworkStatus } from '../../../lib/network';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
type Attempt = {
  id: string;
  completed: boolean;
  expectedVersion: number;
  commandId: string;
};
export function TaskRow({ task, accountId, assignee }: {
  task: Task;
  accountId: string;
  assignee: string;
}) {
  const online = useNetworkStatus();
  const key = 'task-completion:' + task.id;
  const stored = useRef(readDraft<Attempt>(accountId, task.pairId, key));
  const [attempt, setAttempt] = useState<Attempt | undefined>(stored.current);
  const [current, setCurrent] = useState(task);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState(stored.current ? 'Completion is unconfirmed. Retry the same change.' : '');
  useEffect(() => { setCurrent(previous => previous.version > task.version ? previous : task); }, [task]);
  async function submit(next: Attempt) {
    if (!online || pending.current)
      return;
    pending.current = true;
    const scope = captureQueryScope();
    writeDraft(accountId, task.pairId, key, next);
    setAttempt(next);
    setBusy(true);
    setOptimistic(next.completed);
    setError('');
    const result = await setTaskCompleted(next.id, next.completed, next.expectedVersion, next.commandId);
    pending.current = false;
    try {
      scope.assertCurrent();
    }
    catch {
      setBusy(false);
      setOptimistic(null);
      setError('Completion is unconfirmed. Retry the same change.');
      return;
    }
    setBusy(false);
    setOptimistic(null);
    if (result.ok) {
      setCurrent(previous => previous.version > result.data.version ? previous : result.data);
      removeDraft(accountId, task.pairId, key);
      setAttempt(undefined);
    }
    else {
      setError(result.error.code === 'CONFLICT' ? 'This task changed. Open details to review it.' : 'Completion failed. Retry the same change.');
      if (result.error.code !== 'RETRYABLE') {
        removeDraft(accountId, task.pairId, key);
        setAttempt(undefined);
      }
    }
  }
  const completed = optimistic ?? current.completedAt !== null;
  function change(completed: boolean) { void submit({ id: task.id, completed, expectedVersion: current.version, commandId: crypto.randomUUID() }); }
  return <article className={'task-row' + (completed ? ' task-completed' : '')}>
    <div className="task-row-main">
      <label className="task-check">
        <input
          type="checkbox"
          aria-label={'Complete ' + task.title}
          checked={completed}
          disabled={!online || busy || Boolean(attempt)}
          onChange={event => change(event.target.checked)} />
      </label>
      <div className="task-row-content">
        <Link to={'/tasks/' + task.id}>{task.title}
        </Link>
        <span>{assignee}
          {task.dueDate ? ' · Due ' + task.dueDate : ''}
        </span>
      </div>
      {current.completedAt && <Button variant="secondary" disabled={!online || busy || Boolean(attempt)} onClick={() => change(false)}>Undo</Button>}
    </div>
    {error && <Status error>{error}
    </Status>}
    {attempt && !busy && <Button variant="secondary" disabled={!online} onClick={() => void submit(attempt)}>Retry completion</Button>}
  </article>;
}
