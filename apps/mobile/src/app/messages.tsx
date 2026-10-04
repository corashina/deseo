import { Stack } from 'expo-router';
import { MessagesScreen } from '../features/messages';

export default function MessagesRoute() {
  return <><Stack.Screen options={{ title: 'Messages' }} /><MessagesScreen /></>;
}
