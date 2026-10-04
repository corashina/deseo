import { useLocalSearchParams } from 'expo-router';
import { InviteScreen } from '../features/pair';
export default function InviteRoute() { const { token } = useLocalSearchParams<{ token?: string }>(); return <InviteScreen token={token} />; }
