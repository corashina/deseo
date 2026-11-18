import { useId, type ComponentProps } from 'react';
import { Field } from './Field';

const timezones = ['UTC', ...Intl.supportedValuesOf('timeZone')].map(value => ({
  value,
  label: value.replaceAll('_', ' ').split('/').reverse().join(' / '),
}));
// The options never change. Build them once, so a render of the field does not build about 420 elements.
const options = timezones.map(zone => <option key={zone.value} value={zone.value} label={zone.label} />);

// Returns the zone for an exact zone name or a unique city name, such as "warsaw" for Europe/Warsaw.
export function resolveTimezone(value: string) {
  const text = value.trim().replaceAll(' ', '_').toLowerCase();
  const exact = timezones.find(zone => zone.value.toLowerCase() === text);
  if (exact) return exact.value;
  const cities = timezones.filter(zone => zone.value.toLowerCase().split('/').pop() === text);
  return cities.length === 1 ? cities[0].value : undefined;
}

export function TimezoneField(props: Omit<ComponentProps<typeof Field>, 'label' | 'list'>) {
  const listId = useId();
  return <>
    {/* Focus selects the value, so typing a city starts a new search without clearing the field first. */}
    <Field name="timezone" spellCheck={false} autoCorrect="off" {...props} label="Timezone" list={listId} hint="Type a city, such as Warsaw." onFocus={event => { event.currentTarget.select(); props.onFocus?.(event); }} />
    <datalist id={listId}>{options}</datalist>
  </>;
}
