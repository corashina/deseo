import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useMessageSignals, useUnreadCount } from '../features/messages';
// Import the signal modules, not the feature indexes, so the first load skips feature components and styles.
import { useCalendarSignals } from '../features/calendar/realtime';
import { useMemorySignals } from '../features/memories/realtime';
import { useTaskSignals } from '../features/tasks/realtime';
import { PortalNavigation } from '../components/ui/PortalNavigation';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { ListIcon } from '@phosphor-icons/react/dist/csr/List';
import { BrandIcon } from '../components/ui/BrandIcon';
// The rail band has no collapse toggle. Read the width in script so a resize cannot leave a stale toggle.
const railBand = matchMedia('(min-width: 768px) and (max-width: 1023px)');
const subscribe = (change: () => void) => { railBand.addEventListener('change', change); return () => railBand.removeEventListener('change', change); };
export function AppShell({ children }: { children: ReactNode }) {
  const { account, pair } = useSession();
  const accountId = account?.id ?? '';
  const slot = pair?.status === 'active' ? pair.members.find(member => member.userId === account?.id)?.slot : pair?.status === 'pending' ? pair.member.slot : undefined;
  const unread = useUnreadCount(accountId, pair);
  // Keep one channel per feature open while the shell lives, so page changes do not resubscribe.
  useMessageSignals(accountId, pair);
  useCalendarSignals(accountId, pair);
  useMemorySignals(accountId, pair);
  useTaskSignals(accountId, pair);
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const tablet = useSyncExternalStore(subscribe, () => railBand.matches);
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  const destination = pair?.status === 'pending' ? '/pair/waiting' : pair?.status === 'ended' ? '/pair/ended' : '/pair/start';
  const navigation = <PortalNavigation destination={destination} activePair={pair?.status === 'active'} unreadCount={unread.data} onPairOpen={() => setDrawer(false)} />;
  const members = pair?.status === 'active' ? [...pair.members].sort((a, b) => a.slot.localeCompare(b.slot)) : [];
  const names = members.length ? members.map(member => member.displayName) : [account?.displayName ?? 'Deseo'];
  return <div className={`portal ${tablet || collapsed ? 'rail' : ''}`}><a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><div className="brand"><BrandIcon alt="" size={40} /><span className="nav-label" translate="no">Deseo</span>{!tablet && <Button className="collapse-toggle" variant="text" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <CaretRightIcon size={20} aria-hidden="true" /> : <CaretLeftIcon size={20} aria-hidden="true" />}</Button>}</div>{navigation}</aside>
    <div className="portal-body"><header className="topbar">
      <Button variant="text" className="drawer-toggle" aria-label="Open navigation" onClick={() => setDrawer(true)}><ListIcon size={20} aria-hidden="true" />{Boolean(unread.data) && <span className="unread-count" aria-hidden="true">{unread.data}</span>}</Button>
      <div className="topbar-pair"><span className="pair-avatars" aria-hidden="true">{members.length ? members.map(member => <Avatar key={member.userId} slot={member.slot} name={member.displayName} />) : account && <Avatar slot={slot} name={account.displayName} />}</span>
        <span className="topbar-label" translate="no">{names.map((name, index) => <span key={index}>{index > 0 && ' + '}{name}</span>)}</span></div>
      {account && <Link className="button secondary mobile-account" to="/settings" aria-label="Settings"><Avatar slot={slot} name={account.displayName} /></Link>}
    </header>
    <main id="main" tabIndex={-1}>{children}</main></div>
    <Dialog title="Navigation" open={drawer} onClose={() => setDrawer(false)} className="navigation-drawer">{navigation}</Dialog>
  </div>;
}
