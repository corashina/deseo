import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useCore } from '../context';

export function PairWelcomeScreen() {
  const { pair } = useCore();
  if (pair.status !== 'active') return null;
  return <Screen title="Your space is ready">
    {pair.members.map(member => <Badge key={member.userId} label={member.displayName} owner={member.slot} />)}
    <Button label="Add your first event" onPress={() => router.replace('/events/new')} />
    <Button label="Continue to Today" variant="secondary" onPress={() => router.replace('/(tabs)/today')} />
  </Screen>;
}
