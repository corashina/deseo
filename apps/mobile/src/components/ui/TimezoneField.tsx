import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { rawTimeZones, type RawTimeZone } from '@vvo/tzdb';
import { makeStyles, useTheme } from '../../theme';
import { Button } from './Button';
import { Field, useFieldStyles } from './Field';

type Zone = RawTimeZone & { city: string; detail: string; search: string };
const zones: Zone[] = rawTimeZones.map(zone => ({ ...zone, city: zone.mainCities.join(', '),
  detail: `${zone.countryName} · ${zone.alternativeName}`,
  search: [zone.name, ...zone.group, ...zone.mainCities, zone.countryName, zone.alternativeName, zone.abbreviation].join(' ').toLowerCase() }))
  .sort((a, b) => a.rawOffsetInMinutes - b.rawOffsetInMinutes || a.countryName.localeCompare(b.countryName));
const byName = new Map(zones.flatMap(zone => zone.group.map(name => [name, zone] as const)));
const zoneKey = (zone: Zone) => zone.name;

export function TimezoneField({ label = 'Timezone', value, onChange, error, hint, disabled = false }: {
  label?: string; value: string; onChange(value: string): void; error?: string; hint?: string; disabled?: boolean;
}) {
  const theme = useTheme();
  const field = useFieldStyles();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = byName.get(value);
  const shown = selected ? `${selected.mainCities[0]} · ${selected.alternativeName}` : value;
  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? zones.filter(zone => words.every(word => zone.search.includes(word))) : zones;
  }, [query]);
  const close = () => { setOpen(false); setQuery(''); };
  return <View style={field.container}>
    <Text style={field.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${shown}`} accessibilityHint={error ?? hint}
      accessibilityState={{ disabled }} disabled={disabled} onPress={() => setOpen(true)}
      style={({ pressed }) => [field.input, styles.press, !!error && field.invalid, pressed && styles.pressed, disabled && styles.inactive]}>
      <Text style={[theme.typography.body, styles.value]}>{shown}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={field.error}>{error}</Text>
      : hint ? <Text style={theme.typography.secondary}>{hint}</Text> : null}
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[theme.typography.section, styles.value]}>Choose a timezone</Text>
          <Button label="Close" variant="text" onPress={close} />
        </View>
        <View style={styles.search}>
          <Field label="Search" placeholder="City or country" value={query} onChangeText={setQuery}
            autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
        </View>
        <FlatList data={matches} keyExtractor={zoneKey} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ItemSeparatorComponent={Separator} contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={theme.typography.secondary}>No timezone matches this search.</Text>}
          renderItem={({ item }) => {
            const current = item === selected;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: current }}
              accessibilityLabel={`${item.city}. ${item.detail}`} onPress={() => { onChange(item.name); close(); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.value}>
                <Text style={theme.typography.headline}>{item.city}</Text>
                <Text style={theme.typography.secondary}>{item.detail}</Text>
              </View>
              {current && <Ionicons name="checkmark" size={20} color={theme.colors.link} accessibilityElementsHidden importantForAccessibility="no" />}
            </Pressable>;
          }} />
      </SafeAreaView>
    </Modal>
  </View>;
}

function Separator() { return <View style={useTheme().ui.separator} />; }

const useStyles = makeStyles(theme => ({
  press: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  value: { flex: 1 },
  pressed: { backgroundColor: theme.colors.sidebar },
  inactive: { opacity: 0.5 },
  sheet: { flex: 1, backgroundColor: theme.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[4], paddingTop: theme.space[4] },
  search: { padding: theme.space[4] },
  list: { paddingHorizontal: theme.space[4], paddingBottom: theme.space[6] },
  row: { minHeight: theme.touchTarget, flexDirection: 'row', alignItems: 'center', gap: theme.space[3], paddingVertical: theme.space[3] },
}));
