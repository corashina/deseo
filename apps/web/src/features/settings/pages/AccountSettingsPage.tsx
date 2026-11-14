import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { signOut } from '../../auth';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import '../../../styles/settings.css';
export function AccountSettingsPage() {
  const leave = useMutation({ mutationFn: signOut });
  return <section className="card form-page settings-detail"><PageHeader title="Account" description="Choose where to end your session." />
    <section className="settings-section"><h2>Sign out</h2><p>Signing out clears private content and unsent changes from this browser.</p>
    {leave.isError && <Status error>Sign-out failed. Try again.</Status>}<div className="actions"><Button disabled={leave.isPending} onClick={() => leave.mutate('local')}>Sign out on this browser</Button>
    <Button variant="secondary" disabled={leave.isPending} onClick={() => leave.mutate('global')}>Sign out on all devices</Button></div></section><Link to="/settings">Return to settings</Link></section>;
}
