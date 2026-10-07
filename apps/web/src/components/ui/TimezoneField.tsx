import { useId, type ComponentProps } from 'react';
import { Field } from './Field';

const timezones = ['UTC', ...Intl.supportedValuesOf('timeZone')].map(value => ({
  value,
  label: value.replaceAll('_', ' ').split('/').reverse().join(' / '),
}));

export function TimezoneField(props: Omit<ComponentProps<typeof Field>, 'label' | 'list'>) {
  const listId = useId();
  return <>
    <Field {...props} label="Timezone" list={listId} hint="Search by city or timezone." />
    <datalist id={listId}>{timezones.map(zone => <option key={zone.value} value={zone.value} label={zone.label} />)}</datalist>
  </>;
}
