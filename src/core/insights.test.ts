import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';

vi.stubGlobal('window', { initSqlJs: () => initSqlJs(), addEventListener: () => undefined });
vi.stubGlobal('document', {
  baseURI: 'http://localhost/',
  visibilityState: 'visible',
  documentElement: { style: { setProperty: () => undefined }, dataset: {} },
});
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
vi.stubGlobal('fetch', () => Promise.reject(new Error('no server in tests')));

const { sqlite } = await import('../db/sqlite');
const { analytics } = await import('./analytics');
const { scoreRepo } = await import('./repos');

describe('insights score averages', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 12)); // Wednesday 21 Oct 2026
    await sqlite.init();
    for (const [date, score] of [['2026-10-18', 100], ['2026-10-19', 70], ['2026-10-20', 40], ['2026-10-21', 70]] as const) {
      scoreRepo.upsert(date, { score });
    }
  });
  afterAll(() => vi.useRealTimers());

  it('averages every day of the week so far, today included', () => {
    expect(analytics.insights().weeklyAvg).toBe(60);
  });

  it('compares the last 7 days with the last 30 (unlogged days count as 0)', () => {
    const v = analytics.insights();
    expect(v.avg7).toBe(70); // 100, 70, 40, 70 — first logged day is the 18th
    expect(v.avg30).toBe(70);
  });

  it('counts days that scored 100 this month', () => {
    expect(analytics.insights().perfectDaysThisMonth).toBe(1);
  });
});
