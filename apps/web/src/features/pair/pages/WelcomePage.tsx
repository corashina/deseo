import { useSession } from '../../../app/SessionProvider';
import { Avatar } from '../../../components/ui/Avatar';
import { PageHeader } from '../../../components/ui/PageHeader';
export function PairWelcomePage() {
  const { pair } = useSession();
  if (pair?.status !== 'active') return null;
  const members = [...pair.members].sort((a, b) => a.slot.localeCompare(b.slot));
  return <><PageHeader title={members.map(member => member.displayName).join(' + ')} description="Your pair is connected." /><section className="card pair-connected"><p className="eyebrow">YOUR PAIR</p><div className="paired-members">{members.map(member => <div key={member.userId}><Avatar name={member.displayName} slot={member.slot} /><h2>{member.displayName}</h2><span className="muted">Partner {member.slot.toUpperCase()}</span></div>)}</div><p>Shared timezone: <strong>{pair.timezone}</strong></p></section></>;
}
