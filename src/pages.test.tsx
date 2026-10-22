// @vitest-environment jsdom
/** Smoke test: every screen renders against a populated database without throwing. */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import initSqlJs from 'sql.js';
import { addDays, monthOf, today, weekStartOf } from './core/date';

(window as { initSqlJs?: unknown }).initSqlJs = () => initSqlJs();
window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
vi.stubGlobal('IntersectionObserver', IO);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
vi.stubGlobal('fetch', () => Promise.reject(new Error('no server in tests')));

const { sqlite } = await import('./db/sqlite');
const { goals, execution, weeks } = await import('./core/services');
const { routes } = await import('./App');
const { ToastProvider } = await import('./ui/components');

let goalId = '';
const mk = monthOf(today());

beforeAll(async () => {
  await sqlite.init();
  const area = goals.createArea('Health', '', '💪');
  const g = goals.createGoal({
    lifeAreaId: area.id,
    month: mk,
    title: 'Get fit',
    description: 'feel strong',
    weight: 100,
    processes: [
      { name: 'Run', description: '', link: 'https://example.com', weight: 70, targetValue: 1, unit: '' },
      { name: 'Pushups', description: '', link: '', weight: 30, targetValue: 50, unit: 'reps' },
    ],
  });
  goalId = g.id;
  const [run, push] = goals.processesForGoal(g.id);
  execution.toggleProcess(run.id, today());
  execution.setActualValue(push.id, addDays(today(), -1), 20);
  weeks.save(weekStartOf(today()), {
    whatWentWell: 'ran',
    whatDidntGoWell: '',
    whatToChange: '',
    previousActionItemsReviewed: false,
    actionItems: [{ text: 'Sleep', status: 'open' }],
  });
});

afterEach(cleanup);

const errors: unknown[] = [];
vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));

function renderAt(path: string) {
  try {
    sessionStorage.setItem('onboarded', '1');
  } catch {
    /* ignore */
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('screens', () => {
  const cases: [string, () => string, RegExp][] = [
    ['today', () => '/', /Get fit/],
    ['months', () => '/months', /Months/],
    ['month detail', () => `/months/${mk.year}/${mk.month}`, /Calendar/],
    ['goal detail', () => `/months/${mk.year}/${mk.month}/goal/${goalId}`, /Process stats/],
    ['wizard', () => '/goals/new', /Life area/],
    ['insights', () => '/insights', /Process leaderboard/],
    ['reflections', () => '/reflection', /Reflected/],
    ['reflection', () => `/reflection/${weekStartOf(today())}`, /Weekly reflection/],
    ['month review', () => `/review/${mk.year}/${mk.month}`, /wrapped/],
    ['settings', () => '/settings', /Storage/],
    ['welcome', () => '/welcome', /Bring my data/],
  ];
  for (const [name, path, text] of cases) {
    it(`renders ${name}`, async () => {
      errors.length = 0;
      renderAt(path());
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    });
  }
});

describe('today', () => {
  it('completes a process with a single click, and undoes it with the next', async () => {
    renderAt('/');
    const card = (await screen.findByText('Run')).closest('.pcard')!;
    expect(card.getAttribute('aria-pressed')).toBe('true'); // completed in setup
    fireEvent.click(card);
    await screen.findByText('Run');
    expect(screen.getByText('Run').closest('.pcard')!.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByText('Run').closest('.pcard')!);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('Run').closest('.pcard')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('typing a space in a note does not toggle the card', async () => {
    renderAt('/');
    const card = (await screen.findByText('Run')).closest('.pcard')!;
    fireEvent.click(card.querySelector('[aria-label="Note"]')!);
    const before = card.getAttribute('aria-pressed');
    fireEvent.keyDown(card.querySelector('textarea')!, { key: ' ' });
    expect(screen.getByText('Run').closest('.pcard')!.getAttribute('aria-pressed')).toBe(before);
  });
});

describe('daily score chart', () => {
  it('builds a date-continuous series and keeps today out of the averages', async () => {
    const { analytics } = await import('./core/analytics');
    const s = analytics.scoreSeries(30);
    const n = s.points.length;
    // creating the goal scored every day since the 1st of the month (0 until yesterday)
    expect(s.points[0].date).toBe(`${today().slice(0, 7)}-01`);
    expect(s.points.at(-2)!.date).toBe(addDays(today(), -1));
    expect(s.points.slice(-2).map((p) => p.score)).toEqual([12, 70]); // 20/50 pushups × 30 pts; run = 70 pts
    expect(s.points.at(-1)!.isToday).toBe(true);
    expect(s.points.at(-1)!.avg7).toBeNull();
    expect(s.completedDays).toBe(n - 1); // today is in progress
    expect(s.avg).toBe(Math.round(12 / (n - 1)));
    expect(s.securedDays).toBe(0); // nothing reached the minimum viable day (30)
  });

  it('reads days with the keyboard and shows a tooltip', async () => {
    renderAt('/insights');
    const svg = await screen.findByRole('img', { name: /Daily score, \d+ days/ });
    fireEvent.keyDown(svg, { key: 'End' });
    expect(await screen.findByText('In progress', { selector: '.tip-status' })).toBeTruthy();
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(await screen.findByText('Below minimum', { selector: '.tip-status' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Table/ }));
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
  });
});

describe('private mode', () => {
  it('hides personal text but keeps the scores', async () => {
    const { privacy } = await import('./core/privacy');
    renderAt('/');
    expect(await screen.findByText('Get fit')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Private mode' })[0]);
    expect(screen.queryByText('Get fit')).toBeNull();
    expect(screen.queryByText('Run')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Hidden' }).length).toBeGreaterThan(0);
    expect(document.documentElement.hasAttribute('data-private')).toBe(true);
    privacy.set(false);
    expect(await screen.findByText('Get fit')).toBeTruthy();
  });
});
