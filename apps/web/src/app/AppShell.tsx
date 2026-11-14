import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { signOut } from '../features/auth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Status } from '../components/ui/Status';
import { useCommandScope } from '../lib/use-command-scope';
import { useNetworkStatus } from '../lib/network';
import { useMessageSignals, useUnreadCount } from '../features/messages';
import { PortalNavigation } from '../components/ui/PortalNavigation';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { ListIcon } from '@phosphor-icons/react/dist/csr/List';
import icon from '../../../../brand/icon-web.webp';
export function AppShell({ children }: { children: ReactNode }) {
  const { account, pair } = useSession();
  const slot = pair?.status === 'active' ? pair.members.find(member => member.userId === account?.id)?.slot : pair?.status === 'pending' ? pair.member.slot : undefined;
  const unread = useUnreadCount(account?.id ?? '', pair);
  useMessageSignals(account?.id ?? '', pair);
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const online = useNetworkStatus();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const beginScope = useCommandScope(() => setBusy(false));
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  const destination = pair?.status === 'active' ? '/pair/welcome' : pair?.status === 'pending' ? '/pair/waiting' : pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
  const navigation = <PortalNavigation destination={destination} activePair={pair?.status === 'active'} unreadCount={unread.data} onPairOpen={() => setDrawer(false)} />;
  const identity = pair?.status === 'active' ? [...pair.members].sort((a,b) => a.slot.localeCompare(b.slot)).map(member => member.displayName).join(' + ') : account?.displayName;
  return <div className={`portal ${collapsed ? 'collapsed' : ''}`}><a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><div className="brand"><img src={icon} alt="" width={40} height={40} /><span className="nav-label" translate="no">Deseo</span><Button className="collapse-toggle" variant="secondary" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <CaretRightIcon size={20} aria-hidden="true" /> : <CaretLeftIcon size={20} aria-hidden="true" />}</Button></div>{navigation}{account && <Button variant="secondary" className="sidebar-account" aria-label="Account menu" title="Account menu" onClick={() => setMenu(true)}><Avatar slot={slot} name={account.displayName} /><span className="nav-label">Your account</span></Button>}</aside>
    <div className="portal-body"><header className="topbar"><Button variant="secondary" className="drawer-toggle" aria-label="Open navigation" onClick={() => setDrawer(true)}><ListIcon size={20} aria-hidden="true" /></Button><div className="topbar-pair"><span className="pair-avatars" aria-hidden="true">{pair?.status === 'active' ? [...pair.members].sort((a, b) => a.slot.localeCompare(b.slot)).map(member => <Avatar key={member.userId} slot={member.slot} name={member.displayName} />) : account && <Avatar slot={slot} name={account.displayName} />}</span><span className="topbar-label" translate="no">{identity ?? 'Deseo'}</span></div>{account && <Button variant="secondary" className="mobile-account" aria-label="Account menu" onClick={() => setMenu(true)}><Avatar slot={slot} name={account.displayName} /></Button>}</header>
    {!online && <Status>You are offline. Keep this tab open to retain your draft.</Status>}<main id="main" tabIndex={-1}>{children}</main></div>
    <Dialog title="Navigation" open={drawer} onClose={() => setDrawer(false)} className="navigation-drawer">{navigation}</Dialog>
    <Dialog busy={busy} title="Your account" open={menu} onClose={() => setMenu(false)}><Link to="/settings/account" onClick={() => setMenu(false)}>Account settings</Link><p>{account?.displayName}</p><p className="muted">{account?.timezone}</p>{error && <Status error>{error}</Status>}<Button disabled={!online || busy} onClick={async () => { if (!online || busy) return; const scope = beginScope(); setBusy(true); try { await signOut(); } catch { if (scope.isCurrent()) { setBusy(false); setError('Sign-out failed. Try again.'); } } }}>Sign out</Button></Dialog>
  </div>;
}
