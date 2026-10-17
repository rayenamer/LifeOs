/**
 * End-to-end check of the import path: a database written by the Angular LifeOS
 * (here an old v1 file, before the `weight` / `link` migrations) is inspected,
 * imported, migrated, and then driven through the real services.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';
import { SCHEMA_SQL } from './db/schema';
import { addDays, monthOf, today } from './core/date';

// Minimal browser surface for sqlite.ts (no IndexedDB → it warns and keeps working in memory).
vi.stubGlobal('window', { initSqlJs: () => initSqlJs(), addEventListener: () => undefined });
vi.stubGlobal('document', {
  baseURI: 'http://localhost/',
  visibilityState: 'visible',
  documentElement: { style: { setProperty: () => undefined }, dataset: {} },
});
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
vi.stubGlobal('fetch', () => Promise.reject(new Error('no server in tests')));

const { sqlite } = await import('./db/sqlite');
const { analytics, views } = await import('./core/analytics');
const { execution, goals, consistency } = await import('./core/services');
const { streakRepo } = await import('./core/repos');

/** Build a v1 LifeOS database: current DDL minus the columns later migrations added. */
async function legacyDb(): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const v1 = SCHEMA_SQL.replace(/\s*weight\s+INTEGER NOT NULL DEFAULT 0,\n\s*is_demo/, '\n  is_demo')
    .replace(/\s*link\s+TEXT NOT NULL DEFAULT '',/, '')
    .replace(/VALUES \(\d+\);/, 'VALUES (1);');
  db.run(v1);
  const mk = monthOf(today());
  const now = new Date().toISOString();
  db.run(`INSERT INTO life_area VALUES ('a1','Health','','',0,0,'${now}','${now}')`);
  db.run(`INSERT INTO life_area VALUES ('a2','Career','','',1,0,'${now}','${now}')`);
  db.run(`INSERT INTO monthly_goal (id,life_area_id,year,month,title,description,is_demo,created_at,updated_at)
          VALUES ('g1','a1',${mk.year},${mk.month},'Get fit','',0,'${now}','${now}'),
                 ('g2','a2',${mk.year},${mk.month},'Ship it','',0,'${now}','${now}')`);
  db.run(`INSERT INTO process (id,monthly_goal_id,name,description,weight,target_value,unit,position,active,created_at,updated_at)
          VALUES ('p1','g1','Run','',60,1,'',0,1,'${now}','${now}'),
                 ('p2','g1','Pushups','',40,50,'reps',1,1,'${now}','${now}'),
                 ('p3','g2','Deep work','',100,1,'',0,1,'${now}','${now}')`);
  const y = addDays(today(), -1);
  db.run(`INSERT INTO daily_execution VALUES ('e1','p1','${y}',1,NULL,60,'felt great','${now}','${now}')`);
  db.run(`INSERT INTO daily_score VALUES ('s1','${y}',30,1,0,'${now}','${now}')`);
  db.run(`INSERT INTO weekly_reflection VALUES ('r1','2026-01-05','2026-01-11','wins','','',0,'${now}','${now}')`);
  db.run(`INSERT INTO action_item VALUES ('i1','r1','Sleep earlier','open',0,'${now}','${now}')`);
  const bytes = db.export();
  db.close();
  return bytes;
}

describe('importing an Angular LifeOS database', () => {
  let bytes: Uint8Array;
  beforeAll(async () => {
    await sqlite.init();
    bytes = await legacyDb();
  });

  it('previews the file without touching live data', () => {
    const p = sqlite.inspectBytes(bytes);
    expect(p).toMatchObject({ schemaVersion: 1, areas: 2, goals: 2, processes: 3, executions: 1, days: 1, reflections: 1 });
    expect(goals.areas()).toHaveLength(0);
  });

  it('rejects files that are not LifeOS databases', async () => {
    expect(() => sqlite.inspectBytes(new TextEncoder().encode('hello'))).toThrow(/SQLite/);
    const SQL = await initSqlJs();
    const other = new SQL.Database();
    other.run('CREATE TABLE foo (x)');
    expect(() => sqlite.inspectBytes(other.export())).toThrow(/LifeOS/);
  });

  it('imports, migrates to v3, and keeps every row', async () => {
    await sqlite.importBytes(bytes);
    const version = sqlite.query<{ v: number }>('SELECT MAX(version) AS v FROM schema_version')[0].v;
    expect(version).toBe(3);
    const cols = sqlite.query<{ name: string }>('PRAGMA table_info(process)').map((c) => c.name);
    expect(cols).toContain('link');
    expect(goals.areas().map((a) => a.name)).toEqual(['Health', 'Career']);
    expect(execRow('p1')?.note).toBe('felt great');
  });

  it('runs the daily loop on imported data (legacy goals with weight 0 are averaged)', () => {
    const d = today();
    execution.toggleProcess('p1', d); // 60 of Get fit
    execution.setActualValue('p2', d, 25); // 20 of Get fit → goal 80
    execution.toggleProcess('p3', d); // Ship it → 100
    const view = views.todayView(d);
    expect(view.groups.map((g) => g.areaScore).sort()).toEqual([100, 80]);
    expect(view.score).toBe(90); // equal average, since imported goals carry no month weight
    expect(streakRepo.get().currentStreak).toBe(2); // yesterday (30 ≥ mvd 30) + today
  });

  it('respects month weights once they are set', () => {
    goals.setGoalWeights(monthOf(today()), [{ id: 'g1', weight: 25 }, { id: 'g2', weight: 75 }]);
    expect(views.todayView().score).toBe(95); // 80*.25 + 100*.75
  });

  it('feeds analytics, freeze days and reflections', () => {
    const ins = analytics.insights();
    // Rebalancing re-scores the whole month (same as the Angular app): yesterday is now
    // 60*.25 + 0*.75 = 15, below the minimum viable day, so only today counts.
    expect(ins.currentStreak).toBe(1);
    expect(ins.longestStreak).toBe(2); // history is never erased
    expect(ins.scoreByProcess.length).toBe(3);
    expect(analytics.monthTimeline()[0].months[0].isCurrent).toBe(true);
    expect(consistency.canFreeze(today())).toBe(false); // already a valid day
    expect(sqlite.query('SELECT * FROM action_item')).toHaveLength(1);
  });

  it('exports bytes that re-import identically', async () => {
    const out = sqlite.exportBytes();
    const p = sqlite.inspectBytes(out);
    expect(p).toMatchObject({ schemaVersion: 3, areas: 2, goals: 2, processes: 3 });
  });
});

function execRow(processId: string) {
  return sqlite.query<{ note: string }>('SELECT note FROM daily_execution WHERE process_id = ?', [processId])[0];
}
