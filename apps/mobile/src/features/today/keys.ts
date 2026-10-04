export const todayKeys = {
  day: (accountId: string, pairId: string, date: string) => ['today', accountId, pairId, date] as const,
};
