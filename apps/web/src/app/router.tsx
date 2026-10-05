import { useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './SessionProvider';
import { AppShell } from './AppShell';
import { entryIntent, signOut } from '../features/auth';
import { inviteTokenSchema } from '../features/pair';
import { WelcomePage } from '../features/auth/pages/WelcomePage';
import { EmailPage } from '../features/auth/pages/EmailPage';
import { VerifyPage } from '../features/auth/pages/VerifyPage';
import { ProfilePage } from '../features/auth/pages/ProfilePage';
import { StartPage } from '../features/pair/pages/StartPage';
import { InvitePage } from '../features/pair/pages/InvitePage';
import { JoinPage } from '../features/pair/pages/JoinPage';
import { WaitingPage } from '../features/pair/pages/WaitingPage';
import { PairWelcomePage } from '../features/pair/pages/WelcomePage';
import { EndedPage } from '../features/pair/pages/EndedPage';
import { Status } from '../components/ui/Status';
import { Button } from '../components/ui/Button';
function destination(session: ReturnType<typeof useSession>) {
  if (session.status !== 'authenticated') return '/welcome';
  if (!session.account) return '/profile/setup';
  if (session.pair?.status === 'active') return '/pair/welcome';
  if (session.pair?.status === 'pending') return '/pair/waiting';
  if (entryIntent.invite) return '/pair/join';
  return session.pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
}
function Gate({ children, kind = 'pair' }: { children: ReactNode; kind?: 'public' | 'profile' | 'pair' }) {
  const session = useSession();
  const { pathname } = useLocation();
  const target = destination(session);
  if (kind === 'public') return session.status === 'authenticated' ? <Navigate to={target} replace /> : <>{children}</>;
  if (session.status !== 'authenticated') return <Navigate to="/welcome" replace />;
  if (!session.account) return kind === 'profile' ? <>{children}</> : <Navigate to="/profile/setup" replace />;
  if (kind === 'profile') return <Navigate to={target} replace />;
  const allowed = session.pair?.status === 'active' ? ['/pair/welcome'] : session.pair?.status === 'pending' ? ['/pair/waiting', '/pair/invite'] : session.pair?.status === 'ended' ? ['/pair/ended', '/pair/start', '/pair/join'] : ['/pair/start', '/pair/join'];
  return allowed.includes(pathname) ? <>{children}</> : <Navigate to={target} replace />;
}
function Entry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function InviteEntry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function Frame() {
  const session = useSession();
  if (session.status === 'loading') return <div className="entry-loading"><Status>Checking your account…</Status></div>;
  if (session.status === 'error') return <section className="card form-page"><h1>We could not open your account</h1><Status error>{session.error}</Status><Button onClick={() => void session.revalidate()}>Retry</Button><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></section>;
  return session.status === 'authenticated' && session.account ? <AppShell><Outlet /></AppShell> : <div className="entry-container"><Outlet /></div>;
}
function Root() { return <SessionProvider><Frame /></SessionProvider>; }
function Page({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = title + ' · Deseo'; }, [title]);
  return <>{children}</>;
}
// Capture the invitation before router creation, then remove it from browser history.
// No analytics or logging receives the secret.
if (location.pathname === '/invite') {
  const params = new URLSearchParams(location.search);
  const token = params.getAll('token').length === 1 && [...params.keys()].every(key => key === 'token') ? inviteTokenSchema.safeParse(params.get('token')) : null;
  entryIntent.invite = token?.success ? token.data : null;
  entryIntent.invalidInvite = !token?.success;
  history.replaceState(null, '', '/invite');
}
const publicPage = (title: string, element: ReactNode) => <Page title={title}><Gate kind="public">{element}</Gate></Page>;
const pairPage = (title: string, element: ReactNode) => <Page title={title}><Gate>{element}</Gate></Page>;
export const router = createBrowserRouter([{ element: <Root />, children: [
  { path: '/', element: <Page title="Welcome"><Entry /></Page> },
  { path: '/welcome', element: publicPage('Welcome', <WelcomePage />) },
  { path: '/sign-in', element: publicPage('Sign in', <EmailPage />) },
  { path: '/verify', element: publicPage('Check your email', <VerifyPage />) },
  { path: '/profile/setup', element: <Page title="Set up your profile"><Gate kind="profile"><ProfilePage /></Gate></Page> },
  { path: '/pair/start', element: pairPage('Set up your pair', <StartPage />) },
  { path: '/pair/invite', element: pairPage('Invite your partner', <InvitePage />) },
  { path: '/pair/join', element: pairPage('Join your partner', <JoinPage />) },
  { path: '/pair/waiting', element: pairPage('Waiting for your partner', <WaitingPage />) },
  { path: '/pair/welcome', element: pairPage('Your pair', <PairWelcomePage />) },
  { path: '/pair/ended', element: pairPage('Your pair has ended', <EndedPage />) },
  { path: '/invite', element: <Page title="Your invitation"><InviteEntry /></Page> },
  { path: '*', element: <Page title="Page not found"><section className="card form-page"><h1>Page not found</h1><Link to="/">Return to Deseo</Link></section></Page> },
] }]);
