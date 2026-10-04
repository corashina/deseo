import { useLocalSearchParams } from 'expo-router';
import { ListDetailScreen } from '../../../features/tasks';
export default function ListDetail() { const { listId } = useLocalSearchParams<{ listId: string }>(); return <ListDetailScreen listId={listId} />; }
