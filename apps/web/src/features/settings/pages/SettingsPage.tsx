import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import '../../../styles/settings.css';
export function SettingsPage() {
  return <><PageHeader title="Settings" description="Manage your profile, pair, and account." /><nav className="card settings-menu" aria-label="Settings">
    <Link className="settings-link" to="/settings/profile"><h2>Profile</h2><p>Your name and timezone.</p></Link>
    <Link className="settings-link" to="/settings/pair"><h2>Your pair</h2><p>Partner names and shared access.</p></Link>
    <Link className="settings-link" to="/settings/account"><h2>Account</h2><p>Sign out on this browser or all devices.</p></Link>
  </nav></>;
}
