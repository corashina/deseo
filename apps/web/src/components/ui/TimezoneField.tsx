import { useId, type ComponentProps } from 'react';
import { Field } from './Field';

// The options never change. Build them once, so a render of the field does not build about 420 elements.
const options = ['UTC', ...Intl.supportedValuesOf('timeZone')].map(value =>
  <option key={value} value={value} label={value.replaceAll('_', ' ').split('/').reverse().join(' / ')} />);

export function TimezoneField(props: Omit<ComponentProps<typeof Field>, 'label' | 'list'>) {
  const listId = useId();
  return <>
    {/* Focus selects the value, so typing a city starts a new search without clearing the field first. */}
    <Field {...props} label="Timezone" list={listId} hint="Type a city, such as Warsaw." onFocus={event => { event.currentTarget.select(); props.onFocus?.(event); }} />
    <datalist id={listId}>{options}</datalist>
  </>;
}
