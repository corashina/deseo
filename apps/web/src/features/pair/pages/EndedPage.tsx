import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
export function EndedPage() {
  return <section className="card form-page"><PageHeader title="Your pair has ended" description="You can no longer read or change shared content." />
    <p>Start a new pair, or join a pair with a code from your partner.</p>
    <div className="actions"><Link className="button primary" to="/pair/start">Start a new pair</Link><Link className="button secondary" to="/pair/join">Enter invitation</Link></div></section>;
}
