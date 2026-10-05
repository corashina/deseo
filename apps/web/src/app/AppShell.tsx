import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { signOut } from '../features/auth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Status } from '../components/ui/Status';
import icon from '../../../../brand/icon-source.png';
export function AppShell({ children }: { children: ReactNode }) {
  const { account, pair } = useSession();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  const destination = pair?.status === 'active' ? '/pair/welcome' : pair?.status === 'pending' ? '/pair/waiting' : pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
  const navigation = <nav aria-label="Main navigation"><NavLink to={destination} aria-label="Your pair" title="Your pair" onClick={() => setDrawer(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 5 5v1"/></svg><span className="nav-label">Your pair</span></NavLink></nav>;
  const identity = pair?.status === 'active' ? [...pair.members].sort((a,b) => a.slot.localeCompare(b.slot)).map(member => member.displayName).join(' + ') : account?.displayName;
  return <div className={`portal ${collapsed ? 'collapsed' : ''}`}><a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><div className="brand"><img src={icon} alt="" /><span className="nav-label">Deseo</span><Button className="collapse-toggle" variant="secondary" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '›' : '‹'}</Button></div>{navigation}<div className="sidebar-identity"><Avatar name={account?.displayName ?? 'You'} /><span className="nav-label">{identity}</span></div>{account && <Button variant="secondary" className="sidebar-account" aria-label="Account menu" title="Account menu" onClick={() => setMenu(true)}><Avatar name={account.displayName} /><span className="nav-label">Your account</span></Button>}</aside>
    <div className="portal-body"><header className="topbar"><Button variant="secondary" className="drawer-toggle" aria-label="Open navigation" onClick={() => setDrawer(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></Button><span className="topbar-label">{account ? 'Your shared space' : 'Deseo'}</span>{account && <Button variant="secondary" className="mobile-account" aria-label="Account menu" onClick={() => setMenu(true)}><Avatar name={account.displayName} /><span>{account.displayName}</span></Button>}</header>
    {offline && <Status>You are offline. Keep this tab open to retain your draft.</Status>}<main id="main" tabIndex={-1}>{children}</main></div>
    <Dialog title="Navigation" open={drawer} onClose={() => setDrawer(false)} className="navigation-drawer">{navigation}</Dialog>
    <Dialog title="Your account" open={menu} onClose={() => setMenu(false)}><p>{account?.displayName}</p><p className="muted">{account?.timezone}</p>{error && <Status error>{error}</Status>}<Button onClick={async () => { try { await signOut(); } catch { setError('Sign-out failed. Try again.'); } }}>Sign out</Button></Dialog>
  </div>;
}
