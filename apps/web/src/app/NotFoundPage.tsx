import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
export function NotFoundPage() {
  return <section className="card form-page"><PageHeader title="Page not found" description="Check the address or return to Deseo." />
    <Link className="button primary" to="/">Return to Deseo</Link></section>;
}
