// Importance 95: pin times must use account settings when device settings differ.
import { render, screen } from '@testing-library/react-native';
import { Settings } from 'luxon';
import { NoteCard } from './NoteCard';

const message = {
  id: 'note', pairId: 'pair', authorId: 'partner', clientId: 'send',
  body: 'Bring the map.', createdAt: '2026-10-04T10:00:00Z',
  pinnedAt: '2026-10-04T22:30:00Z', version: 1,
};
const deviceZone = Settings.defaultZone;
const deviceLocale = Settings.defaultLocale;
beforeEach(() => { Settings.defaultZone = 'UTC'; Settings.defaultLocale = 'en-US'; });
afterEach(() => { Settings.defaultZone = deviceZone; Settings.defaultLocale = deviceLocale; });

it.each([
  ['Asia/Tokyo', 'en-GB', 'Pinned 5 Oct 2026, 07:30'],
  ['America/Los_Angeles', 'fr', 'Pinned 4 oct. 2026, 15:30'],
])('formats the pin time with account zone %s and locale %s', async (timezone, locale, expected) => {
  await render(<NoteCard message={message} authorName="Sam" timezone={timezone} locale={locale} onReply={jest.fn()} />);
  expect(screen.getByText(expected)).toBeOnTheScreen();
});
