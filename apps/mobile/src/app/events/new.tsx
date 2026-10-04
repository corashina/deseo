import { useLocalSearchParams } from 'expo-router';
import { EventFormScreen } from '../../features/calendar';
export default function NewEvent() {
  const { ideaId } = useLocalSearchParams<{ ideaId?: string }>();
  return <EventFormScreen ideaId={typeof ideaId === 'string' ? ideaId : undefined} />;
}
