import { SettingsPage, ProfileSettingsPage, PairSettingsPage, AccountSettingsPage } from '../features/settings';
import { NotificationsPage, PreferencesPage } from '../features/notifications';
import { MemoriesPage } from '../features/memories/pages/MemoriesPage';
import { MemoryDetailPage } from '../features/memories/pages/MemoryDetailPage';
import { MemoryFormPage } from '../features/memories/pages/MemoryFormPage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { MessagesPage } from '../features/messages';
import { TaskDetailPage } from '../features/tasks/pages/TaskDetailPage';
import { TaskFormPage } from '../features/tasks/pages/TaskFormPage';
import { ListManagerPage } from '../features/tasks/pages/ListManagerPage';
import { ListDetailPage } from '../features/tasks/pages/ListDetailPage';
import { IdeasPage } from '../features/calendar/ideas/pages/IdeasPage';
import { IdeaDetailPage } from '../features/calendar/ideas/pages/IdeaDetailPage';
import { IdeaFormPage } from '../features/calendar/ideas/pages/IdeaFormPage';
import { TodayPage } from '../features/today/pages/TodayPage';
import { CalendarPage } from '../features/calendar/pages/CalendarPage';
import { EventDetailPage } from '../features/calendar/pages/EventDetailPage';
import { EventFormPage } from '../features/calendar/pages/EventFormPage';
import { Fragment, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
import { z } from 'zod';
import { RouteErrorPage, RouteFailureBoundary } from './RouteErrorPage';
import { NotFoundPage } from './NotFoundPage';
import { UnsavedChangesGuard } from '../lib/drafts';
import { useNetworkStatus } from '../lib/network';
function destination(session: ReturnType<typeof useSession>) {
  if (session.status !== 'authenticated') return '/welcome';
  if (!session.account) return '/profile/setup';
  if (session.pair?.status === 'active') return '/pair/welcome';
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
  const allowed = session.pair?.status === 'active' ? ['/pair/welcome', '/today', '/calendar', '/events/new', '/tasks', '/ideas', '/messages', '/memories', ...( /^\/(events|tasks|ideas|memories)\//.test(pathname) ? [pathname] : [])] : session.pair?.status === 'pending' ? ['/pair/waiting', '/pair/invite'] : session.pair?.status === 'ended' ? ['/pair/ended', '/pair/start', '/pair/join'] : ['/pair/start', '/pair/join'];
  return allowed.includes(pathname) ? <>{children}</> : <Navigate to={target} replace />;
}
function Entry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function InviteEntry() { const session = useSession(); return <Navigate to={destination(session)} replace />; }
function Frame() {
  const session = useSession();
  const online = useNetworkStatus();
  const identity = session.userId + ':' + session.pair?.status + ':' + (session.pair && 'pairId' in session.pair ? session.pair.pairId : '');
  if (session.status === 'loading') return <div className="entry-loading"><Status>Checking your account…</Status></div>;
  if (session.status === 'error') return <section className="card form-page"><h1>We could not open your account</h1><Status error>{session.error}</Status><Button onClick={() => void session.revalidate()}>Retry</Button><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></section>;
  return session.status === 'authenticated' && session.account ? <AppShell key={identity}><Outlet /></AppShell> : <div className="entry-container" key={identity}>{!online && <Status>You are offline. Keep this tab open to retain your draft.</Status>}<Outlet /></div>;
}
function Root() { return <SessionProvider><UnsavedChangesGuard /><Frame /></SessionProvider>; }
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
const accountPage = (title: string, element: ReactNode) => <Page title={title}><Gate kind='account'>{element}</Gate></Page>;
function RecordRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  const records = [
    ['eventId', 'Event', '/calendar', 'Return to calendar'],
    ['taskId', 'Task', '/tasks', 'Return to tasks'],
    ['ideaId', 'Idea', '/ideas', 'Return to ideas'],
    ['memoryId', 'Memory', '/memories', 'Return to memories'],
    ['listId', 'List', '/tasks/lists', 'Return to lists'],
  ];
  for (const [key, title, returnTo, returnLabel] of records) {
    if (params[key] && !z.string().uuid().safeParse(params[key]).success)
      return <RouteErrorPage title={title} returnTo={returnTo} returnLabel={returnLabel} />;
  }
  if (pathname === '/events/new' && search.has('idea') && !z.string().uuid().safeParse(search.get('idea')).success)
    return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  return <Fragment key={pathname}>{children}</Fragment>;
}
const pairPage = (title: string, element: ReactNode) => <Page title={title}><Gate><RecordRoute>{element}</RecordRoute></Gate></Page>;
export const router = createBrowserRouter([{ element: <Root />, errorElement: <RouteFailureBoundary />, children: [
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
  { path: '/settings', element: accountPage('Settings', <SettingsPage />) },
  { path: '/settings/profile', element: accountPage('Profile', <ProfileSettingsPage />) },
  { path: '/settings/pair', element: accountPage('Your pair', <PairSettingsPage />) },
  { path: '/settings/account', element: accountPage('Account', <AccountSettingsPage />) },
  { path: '/settings/notifications', element: accountPage('Notification preferences', <PreferencesPage />) },
  { path: '/notifications', element: accountPage('Notifications', <NotificationsPage />) },
  { path: '/today', element: pairPage('Today', <TodayPage />) },
  { path: '/memories', element: pairPage('Memories', <MemoriesPage />) },
  { path: '/memories/new', element: pairPage('Add memory', <MemoryFormPage />) },
  { path: '/memories/:memoryId', element: pairPage('Memory', <MemoryDetailPage />) },
  { path: '/memories/:memoryId/edit', element: pairPage('Edit memory', <MemoryFormPage />) },
  { path: '/messages', element: pairPage('Messages', <MessagesPage />) },
  { path: '/tasks', element: pairPage('Tasks', <TasksPage />) },
  { path: '/tasks/new', element: pairPage('Add task', <TaskFormPage />) },
  { path: '/tasks/lists', element: pairPage('Task lists', <ListManagerPage />) },
  { path: '/tasks/lists/:listId', element: pairPage('Task list', <ListDetailPage />) },
  { path: '/tasks/:taskId', element: pairPage('Task', <TaskDetailPage />) },
  { path: '/tasks/:taskId/edit', element: pairPage('Edit task', <TaskFormPage />) },
  { path: '/ideas', element: pairPage('Date ideas', <IdeasPage />) },
  { path: '/ideas/new', element: pairPage('Add idea', <IdeaFormPage />) },
  { path: '/ideas/:ideaId', element: pairPage('Date idea', <IdeaDetailPage />) },
  { path: '/ideas/:ideaId/edit', element: pairPage('Edit idea', <IdeaFormPage />) },
  { path: '/calendar', element: pairPage('Calendar', <CalendarPage />) },
  { path: '/events/new', element: pairPage('Add event', <EventFormPage />) },
  { path: '/events/:eventId', element: pairPage('Event', <EventDetailPage />) },
  { path: '/events/:eventId/edit', element: pairPage('Edit event', <EventFormPage />) },
  { path: '/invite', element: <Page title="Your invitation"><InviteEntry /></Page> },
  { path: '*', element: <Page title="Page not found"><NotFoundPage /></Page> },
] }]);
