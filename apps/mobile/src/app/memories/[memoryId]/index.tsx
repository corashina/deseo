import { useLocalSearchParams } from 'expo-router';
import { MemoryDetailScreen } from '../../../features/memories';
export default function MemoryRoute() {
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  return <MemoryDetailScreen memoryId={memoryId} />;
}
