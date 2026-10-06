import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import '../../../styles/settings.css';
export function SettingsPage() {
  return <><PageHeader title="Settings" description="Manage your profile, pair, and account." /><div className="settings-grid">
    <Link className="card settings-link" to="/settings/profile"><h2>Profile</h2><p>Your name and timezone.</p></Link>
    <Link className="card settings-link" to="/settings/pair"><h2>Your pair</h2><p>Pair identity and shared access.</p></Link>
    <Link className="card settings-link" to="/settings/notifications"><h2>Notification preferences</h2><p>Reminders, alerts, and quiet hours.</p></Link>
    <Link className="card settings-link" to="/settings/account"><h2>Account</h2><p>Sign out on this browser or all devices.</p></Link>
  </div></>;
}
