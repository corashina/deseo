import { useLocalSearchParams } from 'expo-router';
import { TaskFormScreen } from '../../features/tasks';
export default function NewTask() {
  const params = useLocalSearchParams<{ listId?: string; quick?: string }>();
  return <TaskFormScreen listId={typeof params.listId === 'string' ? params.listId : undefined} quick={params.quick === '1'} />;
}
