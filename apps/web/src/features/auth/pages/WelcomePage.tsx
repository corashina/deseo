import { Link } from 'react-router-dom';
import { entryIntent, useGlobalSignOutFailure } from '..';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { BrandIcon } from '../../../components/ui/BrandIcon';
export function WelcomePage() {
  const globalFailure = useGlobalSignOutFailure();
  return <div className="entry-page"><div className="entry-story"><BrandIcon className="welcome-icon" alt="Deseo Two voices" size={96} priority /><h1>Plan your days together.</h1><p>Keep your plans, messages, and memories in one place.</p></div><section className="card entry-card"><PageHeader title={entryIntent.invite ? 'Your invitation is ready' : <>Welcome to <span translate="no">Deseo</span></>} description={entryIntent.invite ? "Sign in to review your partner's invitation." : 'Use your email address to get a sign-in code.'} />{entryIntent.invalidInvite && <Status error>This invitation is invalid. Ask your partner for a new code.</Status>}{globalFailure && <Status error><p>This browser is signed out. Other sessions may still be active.</p><p>Sign in to the same account. In Settings, choose Sign out on all devices again.</p></Status>}<Link className="button primary" to="/sign-in">Continue with email</Link><p className="muted">A private space for you and your partner.</p></section></div>;
}
