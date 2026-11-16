import { useId, type ComponentProps } from 'react';
import { Field } from './Field';

const timezones = ['UTC', ...Intl.supportedValuesOf('timeZone')].map(value => ({
  value,
  label: value.replaceAll('_', ' ').split('/').reverse().join(' / '),
}));

export function TimezoneField(props: Omit<ComponentProps<typeof Field>, 'label' | 'list'>) {
  const listId = useId();
  return <>
    {/* Focus selects the value, so typing a city starts a new search without clearing the field first. */}
    <Field {...props} label="Timezone" list={listId} hint="Type a city, such as Warsaw." onFocus={event => { event.currentTarget.select(); props.onFocus?.(event); }} />
    <datalist id={listId}>{timezones.map(zone => <option key={zone.value} value={zone.value} label={zone.label} />)}</datalist>
  </>;
}
