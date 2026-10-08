import type { PropsWithChildren, ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View, type FlatListProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../theme';

type Props = PropsWithChildren<{
  title?: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void;
  /** The screen's one main action, beside the title. It wraps below the title on narrow screens. */
  action?: ReactNode;
  /** Controls above the title, such as the pair avatars and notifications. */
  toolbar?: ReactNode;
}>;

export function Screen({ title, subtitle, action, toolbar, children, refreshing = false, onRefresh }: Props) {
  const styles = useStyles();
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        <View style={styles.content}>
          <ScreenHeader title={title} subtitle={subtitle} action={action} toolbar={toolbar} />
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type ListProps<T> = Omit<Props, 'children'> & Pick<FlatListProps<T>, 'data' | 'renderItem' | 'keyExtractor' | 'ListFooterComponent'> & {
  /** Content between the title and the first row, such as status messages. */
  header?: ReactNode;
};

/** A Screen that renders only the rows near the viewport. Use it for feeds that grow without a limit. */
export function ListScreen<T>({ title, subtitle, action, toolbar, header, refreshing = false, onRefresh, ...list }: ListProps<T>) {
  const styles = useStyles();
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <FlatList {...list} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, styles.listContent]}
      ItemSeparatorComponent={Gap} ListHeaderComponentStyle={styles.listHeader}
      ListHeaderComponent={<View style={styles.content}>
        <ScreenHeader title={title} subtitle={subtitle} action={action} toolbar={toolbar} />
        {header}
      </View>}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined} />
  </SafeAreaView>;
}

function Gap() {
  const styles = useStyles();
  return <View style={styles.gap} />;
}

function ScreenHeader({ title, subtitle, action, toolbar }: Omit<Props, 'children' | 'refreshing' | 'onRefresh'>) {
  const theme = useTheme();
  const styles = useStyles();
  return <>
    {toolbar && <View style={styles.toolbar}>{toolbar}</View>}
    {(title || subtitle || action) && <View style={styles.header}>
      <View style={styles.heading}>
        {title && <Text accessibilityRole="header" style={theme.typography.title}>{title}</Text>}
        {subtitle && <Text style={[theme.typography.body, styles.subtitle]}>{subtitle}</Text>}
      </View>
      {action}
    </View>}
  </>;
}

const useStyles = makeStyles(theme => ({
  safe: { flex: 1, backgroundColor: theme.colors.canvas },
  scroll: { flexGrow: 1, paddingHorizontal: theme.space[4], paddingTop: theme.space[2], paddingBottom: theme.space[8] },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: theme.space[6] },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -theme.space[1] },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between',
    columnGap: theme.space[4], rowGap: theme.space[3], paddingTop: theme.space[3], paddingBottom: theme.space[3] },
  heading: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: theme.space[2] },
  subtitle: { color: theme.colors.muted },
  listContent: { width: '100%', maxWidth: 680 + 2 * theme.space[4], alignSelf: 'center' },
  listHeader: { marginBottom: theme.space[4] }, gap: { height: theme.space[4] },
}));
