import { useLocalSearchParams } from 'expo-router';
import { EventFormScreen } from '../../../features/calendar';
export default function EditRoute() { const { eventId } = useLocalSearchParams<{ eventId: string }>(); return <EventFormScreen eventId={eventId} />; }
