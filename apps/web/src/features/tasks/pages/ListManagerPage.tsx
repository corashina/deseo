import { useTaskSignals } from '../realtime';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { useCommandScope } from '../../../lib/use-command-scope';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { listTaskLists, taskKeys } from '../queries';
import { createList } from '../commands';
import '../../../styles/planning.css';
type Draft = {
  name: string;
  attempt?: {
    name: string;
    commandId: string;
  };
};
export function ListManagerPage() {
  const { account, pair } = useSession();
  const online = useNetworkStatus();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const draft = useRef(readDraft<Draft>(account!.id, pairId, 'list-new'));
  const attempt = useRef(draft.current?.attempt);
  const [name, setName] = useState(draft.current?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(attempt.current));
  const [error, setError] = useState('');
  const beginScope = useCommandScope(() => { setSaving(false); });
  useTaskSignals(account!.id, pair);
  const query = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  useUnsavedChanges(Boolean(name));
  async function add() {
    if (!online || saving)
      return;
    const next = attempt.current ?? { name, commandId: crypto.randomUUID() };
    attempt.current = next;
    writeDraft(account!.id, pairId, 'list-new', { name, attempt: next });
    const scope = beginScope();
    setSaving(true);
    setFrozen(true);
    const result = await createList(pairId, next.name, next.commandId);
    if (!scope.isCurrent()) return;
    setSaving(false);
    if (result.ok) {
      removeDraft(account!.id, pairId, 'list-new');
      attempt.current = undefined;
      setName('');
      setFrozen(false);
      setError('');
    }
    else {
      setError(result.error.message ?? 'List save failed. Try again.');
      if (result.error.code !== 'RETRYABLE') {
        attempt.current = undefined;
        setFrozen(false);
        writeDraft(account!.id, pairId, 'list-new', { name });
      }
    }
  }
  return <>
    <PageHeader back={{ to: '/tasks', label: 'Tasks' }} title="Task lists" description="General stays available for shared tasks." />
    <section className="card form-page">
      {query.isPending ? <Status>Loading lists…</Status> : query.isError ? <>
        <Status error>We could not load lists.</Status>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </> : <ul className="list-links">{query.data.map(list => <li key={list.id}>
        <Link to={'/tasks/lists/' + list.id}><span>{list.name}</span>
          {list.isGeneral && <span className="muted">Default list</span>}
        </Link>
      </li>)}
      </ul>}
      <h2>Add list</h2>
      <form className="list-name-form" onSubmit={event => { event.preventDefault(); void add(); }}>
        <label className="field">
          <span>List name</span>
          <input
            value={name}
            maxLength={40}
            required
            disabled={saving || frozen}
            onChange={event => {
              setName(event.target.value);
              writeDraft(account!.id, pairId, 'list-new', { name: event.target.value });
            }} />
        </label>
        {error && <Status error>{error}
        </Status>}
        <Button disabled={!online || saving} type="submit">{saving ? 'Saving…' : frozen ? 'Retry list' : 'Create list'}
        </Button>
      </form>
      <p>
      </p>
    </section>
  </>;
}
