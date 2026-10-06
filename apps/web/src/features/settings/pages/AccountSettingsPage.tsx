import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from '../../auth';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { useNetworkStatus } from '../../../lib/network';
import { captureQueryScope } from '../../../lib/query-client';
export function AccountSettingsPage() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const online = useNetworkStatus();
  const mounted = useRef(false);
  const pending = useRef(false); const scopeCleanup = useRef<() => void>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scopeCleanup.current?.(); }; }, []);
  function beginScope() {
    scopeCleanup.current?.();
    const queryScope = captureQueryScope();
    const unlock = () => { if (mounted.current) { pending.current = false; setBusy(false); } };
    queryScope.signal.addEventListener('abort', unlock, { once: true });
    scopeCleanup.current = () => queryScope.signal.removeEventListener('abort', unlock);
    return queryScope;
  }
  async function leave(scope: 'local' | 'global') {
    if (pending.current || !online) return;
    const queryScope = beginScope(); pending.current = true;
    setBusy(true); setError('');
    try { await signOut(scope); } catch { if (mounted.current && !queryScope.signal.aborted) { setError('Sign-out failed. Try again.'); pending.current = false; setBusy(false); } }
  }
  return <section className="card form-page"><PageHeader title="Account" description="Choose where to end your session." />
    <p>Signing out clears private content and unsent drafts from this browser.</p>
    {error && <Status error>{error}</Status>}<div className="actions"><Button disabled={!online || busy} onClick={() => void leave('local')}>Sign out on this browser</Button>
    <Button variant="secondary" disabled={!online || busy} onClick={() => void leave('global')}>Sign out on all devices</Button></div><Link to="/settings">Return to settings</Link></section>;
}
