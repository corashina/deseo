import { Stack } from 'expo-router';
import { useCore } from '../../features/pair';
export default function PairLayout() {
  const { pair } = useCore();
  return <Stack screenOptions={{ headerBackTitle: 'Back' }}>
    <Stack.Protected guard={pair.status !== 'active'}>
      <Stack.Screen name="start" options={{ title: 'Connect' }} />
      <Stack.Screen name="join" options={{ title: 'Join pair' }} />
      <Stack.Screen name="ended" options={{ title: 'Pair ended' }} />
    </Stack.Protected>
    <Stack.Protected guard={pair.status === 'pending'}><Stack.Screen name="waiting" options={{ title: 'Invitation' }} /></Stack.Protected>
    <Stack.Protected guard={pair.status === 'active'}><Stack.Screen name="welcome" options={{ headerShown: false }} /></Stack.Protected>
  </Stack>;
}
