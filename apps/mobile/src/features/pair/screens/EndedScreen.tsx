import { router } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { useTheme } from '../../../theme';

export function EndedScreen() {
  const theme = useTheme();
  return <Screen title="Your pair has ended">
    <Text style={theme.typography.body}>Shared content is no longer available. A new pair starts empty.</Text>
    <Button label="Start a new pair" onPress={() => router.replace('/(pair)/start')} />
  </Screen>;
}
