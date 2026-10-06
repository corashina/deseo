import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { signOut } from '../features/auth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Status } from '../components/ui/Status';
import { useNetworkStatus } from '../lib/network';
import { useMessageSignals, useUnreadCount } from '../features/messages';
import '../styles/messages.css';
import icon from '../../../../brand/icon-source.png';
export function AppShell({ children }: { children: ReactNode }) {
  const { account, pair } = useSession();
  const unread = useUnreadCount(account?.id ?? '', pair);
  useMessageSignals(account?.id ?? '', pair);
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const online = useNetworkStatus();
  const [error, setError] = useState('');
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  const destination = pair?.status === 'active' ? '/pair/welcome' : pair?.status === 'pending' ? '/pair/waiting' : pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
  const navigation = <nav aria-label="Main navigation"><NavLink to={destination} aria-label="Your pair" title="Your pair" onClick={() => setDrawer(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 5 5v1"/></svg><span className="nav-label">Your pair</span></NavLink>{pair?.status === 'active' && <><NavLink to="/today" aria-label="Today" title="Today"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/></svg><span className="nav-label">Today</span></NavLink><Link to="/calendar" aria-label="Calendar" title="Calendar" className={/^\/(calendar|events|ideas)(\/|$)/.test(location.pathname) ? 'active' : undefined} aria-current={/^\/(calendar|events|ideas)(\/|$)/.test(location.pathname) ? 'page' : undefined}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg><span className="nav-label">Calendar</span></Link><NavLink to="/memories" aria-label="Memories" title="Memories"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg><span className="nav-label">Memories</span></NavLink><NavLink to="/messages" aria-label="Messages" title="Messages"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z"/></svg><span className="nav-label">Messages</span>{unread.data !== undefined && unread.data > 0 && <span className="unread-count" data-testid="unread-count" aria-label={unread.data + ' unread messages'}>{unread.data}</span>}</NavLink><NavLink to="/tasks" aria-label="Tasks" title="Tasks"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m3 6 2 2 4-4m-6 9 2 2 4-4M12 6h9M12 13h9M3 20h18"/></svg><span className="nav-label">Tasks</span></NavLink></>}<NavLink to="/notifications" aria-label="Notifications" title="Notifications"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4"/></svg><span className="nav-label">Notifications</span></NavLink><NavLink to="/settings" aria-label="Settings" title="Settings"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/></svg><span className="nav-label">Settings</span></NavLink></nav>;
  const identity = pair?.status === 'active' ? [...pair.members].sort((a,b) => a.slot.localeCompare(b.slot)).map(member => member.displayName).join(' + ') : account?.displayName;
  return <div className={`portal ${collapsed ? 'collapsed' : ''}`}><a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><div className="brand"><img src={icon} alt="" /><span className="nav-label">Deseo</span><Button className="collapse-toggle" variant="secondary" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '›' : '‹'}</Button></div>{navigation}<div className="sidebar-identity"><Avatar name={account?.displayName ?? 'You'} /><span className="nav-label">{identity}</span></div>{account && <Button variant="secondary" className="sidebar-account" aria-label="Account menu" title="Account menu" onClick={() => setMenu(true)}><Avatar name={account.displayName} /><span className="nav-label">Your account</span></Button>}</aside>
    <div className="portal-body"><header className="topbar"><Button variant="secondary" className="drawer-toggle" aria-label="Open navigation" onClick={() => setDrawer(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></Button><span className="topbar-label">{account ? 'Your shared space' : 'Deseo'}</span>{account && <Button variant="secondary" className="mobile-account" aria-label="Account menu" onClick={() => setMenu(true)}><Avatar name={account.displayName} /><span>{account.displayName}</span></Button>}</header>
    {!online && <Status>You are offline. Keep this tab open to retain your draft.</Status>}<main id="main" tabIndex={-1}>{children}</main></div>
    <Dialog title="Navigation" open={drawer} onClose={() => setDrawer(false)} className="navigation-drawer">{navigation}</Dialog>
    <Dialog title="Your account" open={menu} onClose={() => setMenu(false)}><Link to="/settings/account" onClick={() => setMenu(false)}>Account settings</Link><p>{account?.displayName}</p><p className="muted">{account?.timezone}</p>{error && <Status error>{error}</Status>}<Button onClick={async () => { try { await signOut(); } catch { setError('Sign-out failed. Try again.'); } }}>Sign out</Button></Dialog>
  </div>;
}
