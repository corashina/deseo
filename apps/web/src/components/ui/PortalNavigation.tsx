import { useId, type SyntheticEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { UsersIcon } from '@phosphor-icons/react/dist/csr/Users';
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { ImagesIcon } from '@phosphor-icons/react/dist/csr/Images';
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks';
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix';

const calendarPath = /^\/(calendar|events|ideas)(\/|$)/;

export function PortalNavigation({ destination, activePair, unreadCount, onPairOpen, preload }: {
  destination: string; activePair: boolean; unreadCount: number | undefined; onPairOpen(): void; preload(pathname: string): void;
}) {
  const { pathname } = useLocation();
  const unreadId = useId();
  const unread = unreadCount !== undefined && unreadCount > 0;
  const calendarActive = calendarPath.test(pathname);
  // One listener on the list serves every link.
  const startPreload = (event: SyntheticEvent) => {
    const link = (event.target as Element).closest('a');
    if (link) preload(link.pathname);
  };
  return <nav className="portal-nav" aria-label="Main navigation" onPointerOver={startPreload} onFocus={startPreload}>
    <div className="nav-group">
      {!activePair && <Link to={destination} aria-label="Your pair" title="Your pair" aria-current={pathname.startsWith('/pair/') ? 'page' : undefined} onClick={onPairOpen}>
        <UsersIcon size={20} aria-hidden="true" /><span className="nav-label">Your pair</span>
      </Link>}
      {activePair && <>
        <NavLink to="/today" aria-label="Today" title="Today" aria-describedby={unread ? unreadId : undefined}>
          <HouseIcon size={20} aria-hidden="true" /><span className="nav-label">Today</span>
          {unread && <span className="unread-count" data-testid="unread-count" id={unreadId}>{unreadCount}<span className="visually-hidden"> unread messages</span></span>}
        </NavLink>
        <Link to="/calendar" aria-label="Calendar" title="Calendar" aria-current={calendarActive ? 'page' : undefined}>
          <CalendarBlankIcon size={20} aria-hidden="true" /><span className="nav-label">Calendar</span>
        </Link>
        <NavLink to="/memories" aria-label="Memories" title="Memories"><ImagesIcon size={20} aria-hidden="true" /><span className="nav-label">Memories</span></NavLink>
        <NavLink to="/tasks" aria-label="Tasks" title="Tasks"><ListChecksIcon size={20} aria-hidden="true" /><span className="nav-label">Tasks</span></NavLink>
      </>}
    </div>
    <div className="nav-group nav-settings">
      <NavLink to="/settings" aria-label="Settings" title="Settings"><GearSixIcon size={20} aria-hidden="true" /><span className="nav-label">Settings</span></NavLink>
    </div>
  </nav>;
}
