import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

type Props = PropsWithChildren<{
  title?: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void;
  /** The screen's one main action, beside the title. It wraps below the title on narrow screens. */
  action?: ReactNode;
  /** Controls above the title, such as the pair avatars and notifications. */
  toolbar?: ReactNode;
}>;

export function Screen({ title, subtitle, action, toolbar, children, refreshing = false, onRefresh }: Props) {
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        <View style={styles.content}>
          {toolbar && <View style={styles.toolbar}>{toolbar}</View>}
          {(title || subtitle || action) && <View style={styles.header}>
            <View style={styles.heading}>
              {title && <Text accessibilityRole="header" style={theme.typography.title}>{title}</Text>}
              {subtitle && <Text style={[theme.typography.body, styles.subtitle]}>{subtitle}</Text>}
            </View>
            {action}
          </View>}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.canvas },
  scroll: { flexGrow: 1, paddingHorizontal: theme.space[4], paddingTop: theme.space[2], paddingBottom: theme.space[8] },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: theme.space[4] },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -theme.space[1] },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between',
    columnGap: theme.space[4], rowGap: theme.space[3], paddingTop: theme.space[2], paddingBottom: theme.space[2] },
  heading: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: theme.space[1] },
  subtitle: { color: theme.colors.muted },
});
