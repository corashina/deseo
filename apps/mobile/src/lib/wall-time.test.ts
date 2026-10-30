import { wallDate, wallParts } from './wall-time';

describe('wall time', () => {
  const zone = process.env.TZ;
  afterEach(() => { process.env.TZ = zone; });

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Europe/Warsaw'])('keeps the picked day near midnight in %s', deviceZone => {
    process.env.TZ = deviceZone;
    for (const [date, time] of [['2026-11-06', '00:00'], ['2026-11-06', '23:59'], ['2026-03-29', '02:30'], ['2028-02-29', '00:15']] as const) {
      expect(wallParts(wallDate(date, time)!)).toEqual({ date, time });
    }
  });

  it('rejects an invalid date', () => {
    expect(wallDate('2026-02-30')).toBeNull();
    expect(wallDate('')).toBeNull();
  });
});
