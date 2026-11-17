import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { IdeaState } from '@deseo/domain/calendar';
import { useSession } from '../../../../app/SessionProvider';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Button } from '../../../../components/ui/Button';
import { Status } from '../../../../components/ui/Status';
import { listDateIdeas, ideaKeys } from '../queries';
import { useFrom, useReturnTo } from '../../../../lib/return-to';
import '../../../../styles/planning.css';
export function IdeasPage() {
  const { account, pair } = useSession();
  const [params, setParams] = useSearchParams();
  const state: IdeaState = params.get('state') === 'planned' || params.get('state') === 'archived' ? params.get('state') as IdeaState : 'saved';
  const back = useReturnTo('/calendar');
  const from = useFrom();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useInfiniteQuery({
    queryKey: ideaKeys.list(account!.id, pairId, state),
    queryFn: ({ pageParam }) => listDateIdeas(pairId, state, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined
  });
  return <>
    <PageHeader
      title="Date ideas"
      description="Save something you want to do together."
      action={<Link className="button primary" to="/ideas/new">Add idea</Link>} />
    <div className="section-heading">
      <div className="view-tabs" role="group" aria-label="Idea status">{(['saved', 'planned', 'archived'] as const).map(value => <button key={value} aria-pressed={state === value} onClick={() => setParams({ state: value }, { replace: true, state: { from: back } })}>{value[0].toUpperCase() + value.slice(1)}
      </button>)}
      </div>
      <Link to={back}>Return to calendar</Link>
    </div>
    {query.isPending ? <Status>Loading ideas…</Status> : query.isError ? <>
      <Status error>We could not load ideas.</Status>
      <Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button>
    </> : <>
      <div className="idea-grid">{query.data.pages.flatMap(page => page.items).map(idea => <article className="card" key={idea.id}>
        <h2>
          <Link to={'/ideas/' + idea.id} state={from}>{idea.title}
          </Link>
        </h2>
        {idea.note && <p className="preserve-lines">{idea.note}
        </p>}
        <span className="muted">{idea.state[0].toUpperCase() + idea.state.slice(1)}
        </span>
      </article>)}
      </div>
      {query.data.pages[0].items.length === 0 && <section className="card">
        <p>No {state} ideas.</p>
        {state === 'saved' && <Link to="/ideas/new">Add your first idea</Link>}
      </section>}
      {query.hasNextPage && <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more ideas</Button>}
    </>}
  </>;
}
