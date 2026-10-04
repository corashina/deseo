import { useLocalSearchParams } from 'expo-router';
import { MemoryFormScreen } from '../../../features/memories';
export default function MemoryEditRoute() {
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  return <MemoryFormScreen memoryId={memoryId} />;
}
