import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
export function EndedPage() {
  return <section className="card form-page"><PageHeader title="Your pair has ended" description="You can no longer read or change shared content." /><p>You can create a new pair or join another invitation.</p><Link className="button primary" to="/pair/start">Set up a pair</Link></section>;
}
