import { Fragment, lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { createBrowserRouter, matchRoutes, Navigate, Outlet, type RouteObject, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { SessionProvider, useSession } from './SessionProvider';
import { AppShell } from './AppShell';
import { entryIntent, signOut } from '../features/auth';
import { inviteTokenSchema } from '../features/pair';
import { Status } from '../components/ui/Status';
import { Button } from '../components/ui/Button';
import { z } from 'zod';
import { RouteErrorPage, RouteFailureBoundary } from './RouteErrorPage';
import { NotFoundPage } from './NotFoundPage';
import { UnsavedChangesGuard } from '../lib/unsaved-changes';
// The load function also starts the page chunk download early. See the end of this file.
function lazyPage<T extends Record<K, ComponentType>, K extends keyof T>(load: () => Promise<T>, name: K) {
  return Object.assign(lazy(() => load().then(module => ({ default: module[name] }))), { load });
}
type LazyPage = LazyExoticComponent<ComponentType> & { load: () => Promise<unknown> };
const SettingsPage = lazyPage(() => import('../features/settings'), 'SettingsPage');
const MemoriesPage = lazyPage(() => import('../features/memories/pages/MemoriesPage'), 'MemoriesPage');
const MemoryDetailPage = lazyPage(() => import('../features/memories/pages/MemoryDetailPage'), 'MemoryDetailPage');
const MemoryFormPage = lazyPage(() => import('../features/memories/pages/MemoryFormPage'), 'MemoryFormPage');
const TasksPage = lazyPage(() => import('../features/tasks/pages/TasksPage'), 'TasksPage');
const TaskDetailPage = lazyPage(() => import('../features/tasks/pages/TaskDetailPage'), 'TaskDetailPage');
const IdeasPage = lazyPage(() => import('../features/calendar/ideas/pages/IdeasPage'), 'IdeasPage');
const IdeaFormPage = lazyPage(() => import('../features/calendar/ideas/pages/IdeaFormPage'), 'IdeaFormPage');
const TodayPage = lazyPage(() => import('../features/today/pages/TodayPage'), 'TodayPage');
const CalendarPage = lazyPage(() => import('../features/calendar/pages/CalendarPage'), 'CalendarPage');
const EventDetailPage = lazyPage(() => import('../features/calendar/pages/EventDetailPage'), 'EventDetailPage');
const EventFormPage = lazyPage(() => import('../features/calendar/pages/EventFormPage'), 'EventFormPage');
const WelcomePage = lazyPage(() => import('../features/auth/pages/WelcomePage'), 'WelcomePage');
const EmailPage = lazyPage(() => import('../features/auth/pages/EmailPage'), 'EmailPage');
const VerifyPage = lazyPage(() => import('../features/auth/pages/VerifyPage'), 'VerifyPage');
const ProfilePage = lazyPage(() => import('../features/auth/pages/ProfilePage'), 'ProfilePage');
const StartPage = lazyPage(() => import('../features/pair/pages/StartPage'), 'StartPage');
const JoinPage = lazyPage(() => import('../features/pair/pages/JoinPage'), 'JoinPage');
const WaitingPage = lazyPage(() => import('../features/pair/pages/WaitingPage'), 'WaitingPage');
const EndedPage = lazyPage(() => import('../features/pair/pages/EndedPage'), 'EndedPage');
function destination(session: ReturnType<typeof useSession>) {
  if (session.status !== 'authenticated') return '/welcome';
  if (!session.account) return '/profile/setup';
  if (session.pair?.status === 'active') return '/today';
  if (session.pair?.status === 'pending') return '/pair/waiting';
  if (entryIntent.invite) return '/pair/join';
  return session.pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
}
function Gate({ children, kind = 'pair' }: { children: ReactNode; kind?: 'public' | 'profile' | 'pair' | 'account' }) {
  const session = useSession();
  const { pathname } = useLocation();
  const target = destination(session);
  if (kind === 'public') return session.status === 'authenticated' ? <Navigate to={target} replace /> : <>{children}</>;
  if (session.status !== 'authenticated') return <Navigate to="/welcome" replace />;
  if (!session.account) return kind === 'profile' ? <>{children}</> : <Navigate to="/profile/setup" replace />;
  if (kind === 'account') return <>{children}</>;
  if (kind === 'profile') return <Navigate to={target} replace />;
  const allowed = session.pair?.status === 'active' ? ['/today', '/calendar', '/events/new', '/tasks', '/ideas', '/memories', ...( /^\/(events|tasks|ideas|memories)\//.test(pathname) ? [pathname] : [])] : session.pair?.status === 'pending' ? ['/pair/waiting'] : session.pair?.status === 'ended' ? ['/pair/ended', '/pair/start', '/pair/join'] : ['/pair/start', '/pair/join'];
  return allowed.includes(pathname) ? <>{children}</> : <Navigate to={target} replace />;
}
function Entry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function InviteEntry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function Frame() {
  const session = useSession();
  const identity = session.userId + ':' + session.pair?.status + ':' + (session.pair && 'pairId' in session.pair ? session.pair.pairId : '');
  if (session.status === 'loading') return <div className="entry-loading"><Status>Checking your account…</Status></div>;
  if (session.status === 'error') return <section className="card form-page"><h1>We could not open your account</h1><Status error>{session.error}</Status><Button variant="primary" onClick={() => void session.revalidate()}>Retry</Button><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></section>;
  return session.status === 'authenticated' && session.account ? <AppShell key={identity}><Outlet /></AppShell> : <div className="entry-container" key={identity}><Outlet /></div>;
}
function Root() { return <SessionProvider><UnsavedChangesGuard /><Frame /></SessionProvider>; }
function Page({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = title + ' · Deseo'; }, [title]);
  return <Suspense fallback={<Status>Loading page…</Status>}>{children}</Suspense>;
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
const publicPage = (title: string, Component: LazyPage) => ({ element: <Page title={title}><Gate kind="public"><Component /></Gate></Page>, handle: Component.load });
const accountPage = (title: string, Component: LazyPage) => ({ element: <Page title={title}><Gate kind="account"><Component /></Gate></Page>, handle: Component.load });
function RecordRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  const records = [
    ['eventId', 'Event', '/calendar', 'Return to calendar'],
    ['taskId', 'Task', '/tasks', 'Return to tasks'],
    ['ideaId', 'Idea', '/ideas', 'Return to ideas'],
    ['memoryId', 'Memory', '/memories', 'Return to memories'],
  ];
  for (const [key, title, returnTo, returnLabel] of records) {
    if (params[key] && !z.string().uuid().safeParse(params[key]).success)
      return <RouteErrorPage title={title} returnTo={returnTo} returnLabel={returnLabel} />;
  }
  if (pathname === '/events/new' && search.has('idea') && !z.string().uuid().safeParse(search.get('idea')).success)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  return <Fragment key={pathname}>{children}</Fragment>;
}
const pairPage = (title: string, Component: LazyPage) => ({ element: <Page title={title}><Gate><RecordRoute><Component /></RecordRoute></Gate></Page>, handle: Component.load });
const routes: RouteObject[] = [{ element: <Root />, errorElement: <RouteFailureBoundary />, children: [
  { path: '/', element: <Page title="Welcome"><Entry /></Page> },
  { path: '/welcome', ...publicPage('Welcome', WelcomePage) },
  { path: '/sign-in', ...publicPage('Sign in', EmailPage) },
  { path: '/verify', ...publicPage('Check your email', VerifyPage) },
  { path: '/profile/setup', element: <Page title="Set up your profile"><Gate kind="profile"><ProfilePage /></Gate></Page>, handle: ProfilePage.load },
  { path: '/pair/start', ...pairPage('Set up your pair', StartPage) },
  { path: '/pair/join', ...pairPage('Join your partner', JoinPage) },
  { path: '/pair/waiting', ...pairPage('Waiting for your partner', WaitingPage) },
  { path: '/pair/ended', ...pairPage('Your pair has ended', EndedPage) },
  { path: '/settings', ...accountPage('Settings', SettingsPage) },
  { path: '/today', ...pairPage('Today', TodayPage) },
  { path: '/memories', ...pairPage('Memories', MemoriesPage) },
  { path: '/memories/new', ...pairPage('Add memory', MemoryFormPage) },
  { path: '/memories/:memoryId', ...pairPage('Memory', MemoryDetailPage) },
  { path: '/memories/:memoryId/edit', ...pairPage('Edit memory', MemoryFormPage) },
  { path: '/tasks', ...pairPage('Tasks', TasksPage) },
  { path: '/tasks/:taskId', ...pairPage('Task', TaskDetailPage) },
  { path: '/ideas', ...pairPage('Date ideas', IdeasPage) },
  { path: '/ideas/new', ...pairPage('Add idea', IdeaFormPage) },
  { path: '/ideas/:ideaId', ...pairPage('Date idea', IdeaFormPage) },
  { path: '/calendar', ...pairPage('Calendar', CalendarPage) },
  { path: '/events/new', ...pairPage('Add event', EventFormPage) },
  { path: '/events/:eventId', ...pairPage('Event', EventDetailPage) },
  { path: '/events/:eventId/edit', ...pairPage('Edit event', EventFormPage) },
  { path: '/invite', element: <Page title="Your invitation"><InviteEntry /></Page> },
  { path: '*', element: <Page title="Page not found"><NotFoundPage /></Page> },
] }];
export const router = createBrowserRouter(routes);
// Fetch the page chunk for the first URL while the session check runs.
// The lazy page reports a failed fetch, so ignore it here.
const initialPage: LazyPage['load'] | undefined = matchRoutes(routes, location)?.at(-1)?.route.handle;
initialPage?.().catch(() => undefined);
