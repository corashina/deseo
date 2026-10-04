import { useLocalSearchParams } from 'expo-router';
import { IdeaFormScreen } from '../../../features/calendar';
export default function EditIdea() {
  const { ideaId } = useLocalSearchParams<{ ideaId: string }>();
  return <IdeaFormScreen ideaId={ideaId} />;
}
