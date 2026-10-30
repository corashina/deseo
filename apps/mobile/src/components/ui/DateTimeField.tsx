import { useId } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { DateTime } from 'luxon';
import { makeStyles, useTheme } from '../../theme';
import { wallDate, wallParts } from '../../lib/wall-time';
import { Button } from './Button';
import { useFieldStyles } from './Field';

export type DateTimeFieldProps = {
  label: string; mode: 'date' | 'time';
  /** YYYY-MM-DD for dates, HH:mm for times. An empty string means no value. */
  value: string; onChange(value: string): void;
  /** The value the picker opens on when the field is empty. Clear appears when this is set. */
  emptyValue?: string;
  error?: string; hint?: string; disabled?: boolean;
};

const timeDay = '2000-01-01';
const parse = (mode: DateTimeFieldProps['mode'], value: string) => mode === 'date' ? wallDate(value) : wallDate(timeDay, value);
const pick = (mode: DateTimeFieldProps['mode'], value: Date) => wallParts(value)[mode];
const display = (mode: DateTimeFieldProps['mode'], value: string) => mode === 'date'
  ? DateTime.fromISO(value).toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY)
  : DateTime.fromFormat(value, 'HH:mm').toLocaleString(DateTime.TIME_SIMPLE);
const now = () => { const local = DateTime.local(); return wallDate(local.toISODate()!, local.toFormat('HH:mm'))!; };

export function DateTimeField({ label, mode, value, onChange, emptyValue, error, hint, disabled = false }: DateTimeFieldProps) {
  const theme = useTheme();
  const field = useFieldStyles();
  const styles = useStyles();
  const id = useId();
  const current = parse(mode, value);
  const fallback = emptyValue === undefined ? null : parse(mode, emptyValue);
  const shown = current ? display(mode, value) : 'Not set';
  const open = () => DateTimePickerAndroid.open({ value: current ?? fallback ?? now(), mode, timeZoneName: 'UTC',
    onValueChange: (_, picked) => onChange(pick(mode, picked)) });
  return <View style={field.container}>
    <Text nativeID={id} style={field.label}>{label}</Text>
    <View style={styles.line}>
      {Platform.OS === 'ios' && current ? <RNDateTimePicker value={current} mode={mode} display="compact" timeZoneName="UTC"
        accessibilityLabel={label} disabled={disabled} accentColor={theme.colors.focus} themeVariant={theme.dark ? 'dark' : 'light'}
        onValueChange={(_, picked) => onChange(pick(mode, picked))} />
        : Platform.OS === 'ios' ? <Button label={`Choose ${mode}`} variant="secondary" compact disabled={disabled}
          onPress={() => onChange(pick(mode, fallback ?? now()))} />
        : <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${shown}`} accessibilityHint={error ?? hint}
          accessibilityState={{ disabled }} disabled={disabled} onPress={open}
          style={({ pressed }) => [field.input, styles.press, !!error && field.invalid, pressed && styles.pressed, disabled && styles.inactive]}>
          <Text style={[theme.typography.body, !current && styles.empty]}>{shown}</Text>
        </Pressable>}
      {emptyValue !== undefined && current && <Button label="Clear" variant="text" disabled={disabled} onPress={() => onChange('')} />}
    </View>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={field.error}>{error}</Text>
      : hint ? <Text style={theme.typography.secondary}>{hint}</Text> : null}
  </View>;
}

const useStyles = makeStyles(theme => ({
  line: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  press: { flex: 1, justifyContent: 'center' },
  pressed: { backgroundColor: theme.colors.sidebar },
  inactive: { opacity: 0.5 },
  empty: { color: theme.colors.muted },
}));
