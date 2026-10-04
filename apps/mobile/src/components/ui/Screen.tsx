import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

type Props = PropsWithChildren<{ title?: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void }>;

export function Screen({ title, subtitle, children, refreshing = false, onRefresh }: Props) {
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        <View style={styles.content}>
          {title && <Text accessibilityRole="header" style={theme.typography.title}>{title}</Text>}
          {subtitle && <Text style={theme.typography.body}>{subtitle}</Text>}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.canvas }, scroll: { flexGrow: 1, padding: 16 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 20, paddingBottom: 24 },
});
