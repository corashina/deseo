import { useLocalSearchParams } from 'expo-router';
import { IdeaDetailScreen } from '../../../features/calendar';
export default function IdeaDetail() {
  const { ideaId } = useLocalSearchParams<{ ideaId: string }>();
  return <IdeaDetailScreen ideaId={ideaId} />;
}
