import { Link, useRouteError } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { UnsavedChangesGuard } from '../lib/unsaved-changes';

export function RouteErrorPage({ title, returnTo, returnLabel, error, onRetry }: {
  title: string; returnTo: string; returnLabel: string; error?: unknown; onRetry?: () => void;
}) {
  const code = error === undefined ? 'FORBIDDEN' : toAppError(error).code;
  const unavailable = code === 'FORBIDDEN' || code === 'UNAUTHENTICATED' || code === 'VALIDATION';
  return <section className="card form-page">
    <PageHeader title={unavailable ? title + ' unavailable' : 'We could not load this ' + title.toLowerCase()} />
    <p role={unavailable ? undefined : 'alert'}>{unavailable ? 'You cannot open this content.' : 'Keep this tab open and retry.'}</p>
    <div className="actions">{!unavailable && onRetry && <Button variant="primary" onClick={onRetry}>Retry</Button>}
      <Link className="button secondary" to={returnTo}>{returnLabel}</Link></div>
  </section>;
}

export function RouteFailureBoundary() {
  const error = useRouteError();
  return <div className="entry-container"><UnsavedChangesGuard /><RouteErrorPage title="Page" returnTo="/" returnLabel="Return to Deseo" error={error} onRetry={() => location.reload()} /></div>;
}
