import { useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../../app/SessionProvider';
import { useCommandId } from '../../../../lib/command-id';
import { useUnsavedChanges } from '../../../../lib/unsaved-changes';
import { useFrom } from '../../../../lib/return-to';
import { Button } from '../../../../components/ui/Button';
import { Field } from '../../../../components/ui/Field';
import { Status } from '../../../../components/ui/Status';
import { ideaKeys, listDateIdeas } from '../queries';
import { createIdea } from '../commands';
import '../../../../styles/planning.css';

// Saved date ideas sit under the calendar. A title adds an idea; its page holds the note and link.
export function IdeasSection({ pairId }: { pairId: string }) {
  const { account } = useSession();
  const from = useFrom();
  const query = useInfiniteQuery({
    queryKey: ideaKeys.list(account!.id, pairId),
    queryFn: ({ pageParam }) => listDateIdeas(pairId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const ideas = query.data?.pages.flatMap(page => page.items) ?? [];
  return <section className="card ideas-section" aria-labelledby="ideas-heading">
    <h2 id="ideas-heading">Date ideas</h2>
    <AddIdea pairId={pairId} />
    {query.isPending ? <Status>Loading ideas…</Status> : query.isError ? <>
      <Status error>We could not load ideas.</Status>
      <Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button>
    </> : ideas.length === 0 ? <p className="muted">No saved ideas yet.</p> : <ul className="idea-list">{ideas.map(idea => <li key={idea.id}>
      <Link className="idea-row" to={'/ideas/' + idea.id} state={from}><strong>{idea.title}</strong>{idea.note && <span>{idea.note}</span>}</Link>
      <Link className="button secondary" to={'/events/new?idea=' + idea.id} state={from}>Plan date</Link>
    </li>)}</ul>}
    {query.hasNextPage && <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more ideas</Button>}
  </section>;
}

function AddIdea({ pairId }: { pairId: string }) {
  const [title, setTitle] = useState('');
  // The idea ID belongs to the input, so a retry of the same input sends the same request.
  const [id, setId] = useState(() => crypto.randomUUID());
  const command = useCommandId();
  const add = useMutation({
    mutationFn: () => {
      const input = { id, pairId, title, note: '', link: '' };
      return createIdea(input, command.idFor(input));
    },
    onSuccess: () => { setTitle(''); setId(crypto.randomUUID()); command.reset(); },
  });
  useUnsavedChanges(Boolean(title));
  return <form className="quick-add" onSubmit={event => { event.preventDefault(); if (!add.isPending) add.mutate(); }}>
    <Field label="New idea" name="title" value={title} required maxLength={120} disabled={add.isPending} onChange={event => setTitle(event.target.value)} />
    <Button variant="primary" type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : add.isError ? 'Retry idea' : 'Add idea'}</Button>
    {add.isError && <Status error>{toAppError(add.error).message}</Status>}
  </form>;
}
