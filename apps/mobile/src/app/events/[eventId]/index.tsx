import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '../../../features/calendar';
export default function EventRoute() { const { eventId } = useLocalSearchParams<{ eventId: string }>(); return <EventDetailScreen eventId={eventId} />; }
