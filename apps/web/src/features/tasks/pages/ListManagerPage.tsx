import { useTaskSignals } from '../realtime';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { Link } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { listTaskLists, taskKeys } from '../queries';
import { createList } from '../commands';
import '../../../styles/planning.css';
export function ListManagerPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const [name, setName] = useState('');
  useTaskSignals(account!.id, pair);
  const query = useQuery({ queryKey: taskKeys.lists(account!.id, pairId), queryFn: () => listTaskLists(pairId) });
  const command = useCommandId();
  const add = useMutation({ mutationFn: () => createList(pairId, name, command.idFor({ pairId, name })), onSuccess: () => { setName(''); command.reset(); } });
  useUnsavedChanges(Boolean(name));
  return <>
    <PageHeader title="Task lists" description="General stays available for shared tasks." />
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
      <form className="list-name-form" onSubmit={event => { event.preventDefault(); if (!add.isPending) add.mutate(); }}>
        <Field
          label="List name"
          name="listName"
          value={name}
          maxLength={40}
          required
          disabled={add.isPending}
          onChange={event => setName(event.target.value)} />
        {add.isError && <Status error>{toAppError(add.error).message}
        </Status>}
        <Button disabled={add.isPending} type="submit">{add.isPending ? 'Saving…' : add.isError ? 'Retry list' : 'Create list'}
        </Button>
      </form>
      <p>
        <Link to="/tasks">Return to tasks</Link>
      </p>
    </section>
  </>;
}
