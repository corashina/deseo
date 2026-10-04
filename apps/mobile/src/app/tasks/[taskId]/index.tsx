import { useLocalSearchParams } from 'expo-router';
import { TaskDetailScreen } from '../../../features/tasks';
export default function TaskDetail() { const { taskId } = useLocalSearchParams<{ taskId: string }>(); return <TaskDetailScreen taskId={taskId} />; }
