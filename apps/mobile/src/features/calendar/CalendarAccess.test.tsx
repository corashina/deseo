// Importance: 100. New idea routes must hide content until current membership is valid.
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CalendarAccess } from './CalendarAccess';
import { usePairGate } from '../pair';
jest.mock('../pair', () => ({ usePairGate: jest.fn() }));
jest.mock('../../components/ui/Screen', () => { const { View } = jest.requireActual('react-native'); return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> }; });
const gate = { account: { id: 'account' }, pair: { status: 'active', pairId: 'pair' }, checking: false, error: null, online: true, refresh: jest.fn() };
it('removes idea content during access checks and after pair closure', async () => {
  jest.mocked(usePairGate).mockReturnValue(gate as never);
  await render(<CalendarAccess><Text>Private idea</Text></CalendarAccess>);
  expect(screen.getByText('Private idea')).toBeOnTheScreen();
  jest.mocked(usePairGate).mockReturnValue({ ...gate, checking: true, pair: null } as never);
  await screen.rerender(<CalendarAccess><Text>Private idea</Text></CalendarAccess>);
  expect(screen.queryByText('Private idea')).toBeNull();
  jest.mocked(usePairGate).mockReturnValue({ ...gate, pair: { status: 'ended' } } as never);
  await screen.rerender(<CalendarAccess><Text>Private idea</Text></CalendarAccess>);
  expect(screen.queryByText('Private idea')).toBeNull();
});
