/**
 * Repositories: the only place SQL lives. Columns are snake_case in SQLite and
 * mapped to camelCase entities here — identical to the Angular LifeOS repos.
 */
import { sqlite as db, SqlRow } from '../db/sqlite';
import type {
  ActionItem,
  ActionItemStatus,
  AppSettings,
  DailyExecution,
  DailyScore,
  LifeArea,
  MonthKey,
  MonthlyGoal,
  Process,
  Streak,
  ThemeMode,
  WeeklyReflection,
  WeeklyReflectionWithItems,
} from './models';
import { nowIso, weekEndOf } from './date';
import { uid } from './id';

// --- row helpers ---------------------------------------------------------------

const str = (r: SqlRow, k: string): string => (r[k] == null ? '' : String(r[k]));
const strOrNull = (r: SqlRow, k: string): string | null => (r[k] == null ? null : String(r[k]));
const num = (r: SqlRow, k: string): number => (r[k] == null ? 0 : Number(r[k]));
const numOrNull = (r: SqlRow, k: string): number | null => (r[k] == null ? null : Number(r[k]));
const bool = (r: SqlRow, k: string): boolean => num(r, k) !== 0;
const b = (v: boolean): number => (v ? 1 : 0);

// --- life areas ------------------------------------------------------------------

const mapArea = (r: SqlRow): LifeArea => ({
  id: str(r, 'id'),
  name: str(r, 'name'),
  description: str(r, 'description'),
  icon: str(r, 'icon'),
  position: num(r, 'position'),
  isDemo: bool(r, 'is_demo'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export const areaRepo = {
  all: (): LifeArea[] => db.query<SqlRow>('SELECT * FROM life_area ORDER BY position, name').map(mapArea),
  byId(id: string): LifeArea | null {
    const rows = db.query<SqlRow>('SELECT * FROM life_area WHERE id = ?', [id]);
    return rows.length ? mapArea(rows[0]) : null;
  },
  create(data: Partial<LifeArea> & { name: string }): LifeArea {
    const now = nowIso();
    const a: LifeArea = {
      id: uid(),
      name: data.name,
      description: data.description ?? '',
      icon: data.icon ?? '',
      position: data.position ?? areaRepo.all().length,
      isDemo: data.isDemo ?? false,
      createdAt: now,
      updatedAt: now,
    };
    db.run(
      `INSERT INTO life_area (id, name, description, icon, position, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.name, a.description, a.icon, a.position, b(a.isDemo), now, now],
    );
    return a;
  },
  update(id: string, patch: Partial<LifeArea>): void {
    const cur = areaRepo.byId(id);
    if (!cur) return;
    const n = { ...cur, ...patch };
    db.run(
      'UPDATE life_area SET name = ?, description = ?, icon = ?, position = ?, updated_at = ? WHERE id = ?',
      [n.name, n.description, n.icon, n.position, nowIso(), id],
    );
  },
};

// --- monthly goals ------------------------------------------------------------------

const mapGoal = (r: SqlRow): MonthlyGoal => ({
  id: str(r, 'id'),
  lifeAreaId: str(r, 'life_area_id'),
  year: num(r, 'year'),
  month: num(r, 'month'),
  title: str(r, 'title'),
  description: str(r, 'description'),
  weight: num(r, 'weight'),
  isDemo: bool(r, 'is_demo'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export const goalRepo = {
  byId(id: string): MonthlyGoal | null {
    const rows = db.query<SqlRow>('SELECT * FROM monthly_goal WHERE id = ?', [id]);
    return rows.length ? mapGoal(rows[0]) : null;
  },
  forMonth: ({ year, month }: MonthKey): MonthlyGoal[] =>
    db
      .query<SqlRow>(
        `SELECT g.* FROM monthly_goal g JOIN life_area a ON a.id = g.life_area_id
         WHERE g.year = ? AND g.month = ? ORDER BY a.position, a.name`,
        [year, month],
      )
      .map(mapGoal),
  forAreaAndMonth(lifeAreaId: string, { year, month }: MonthKey): MonthlyGoal | null {
    const rows = db.query<SqlRow>(
      'SELECT * FROM monthly_goal WHERE life_area_id = ? AND year = ? AND month = ?',
      [lifeAreaId, year, month],
    );
    return rows.length ? mapGoal(rows[0]) : null;
  },
  distinctMonths: (): MonthKey[] =>
    db
      .query<SqlRow>('SELECT DISTINCT year, month FROM monthly_goal ORDER BY year DESC, month DESC')
      .map((r) => ({ year: num(r, 'year'), month: num(r, 'month') })),
  create(data: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>): MonthlyGoal {
    const now = nowIso();
    const g: MonthlyGoal = { ...data, id: uid(), createdAt: now, updatedAt: now };
    db.run(
      `INSERT INTO monthly_goal (id, life_area_id, year, month, title, description, weight, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [g.id, g.lifeAreaId, g.year, g.month, g.title, g.description, Math.round(g.weight) || 0, b(g.isDemo), now, now],
    );
    return g;
  },
  update(id: string, patch: Partial<Pick<MonthlyGoal, 'title' | 'description' | 'weight'>>): void {
    const cur = goalRepo.byId(id);
    if (!cur) return;
    const n = { ...cur, ...patch };
    db.run('UPDATE monthly_goal SET title = ?, description = ?, weight = ?, updated_at = ? WHERE id = ?', [
      n.title,
      n.description,
      Math.round(n.weight) || 0,
      nowIso(),
      id,
    ]);
  },
  delete: (id: string): void => db.run('DELETE FROM monthly_goal WHERE id = ?', [id]),
};

// --- processes ------------------------------------------------------------------

const mapProcess = (r: SqlRow): Process => ({
  id: str(r, 'id'),
  monthlyGoalId: str(r, 'monthly_goal_id'),
  name: str(r, 'name'),
  description: str(r, 'description'),
  link: str(r, 'link'),
  weight: num(r, 'weight'),
  targetValue: num(r, 'target_value'),
  unit: str(r, 'unit'),
  position: num(r, 'position'),
  active: bool(r, 'active'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export type ProcessDraft = Omit<Process, 'id' | 'createdAt' | 'updatedAt'>;

export const processRepo = {
  byId(id: string): Process | null {
    const rows = db.query<SqlRow>('SELECT * FROM process WHERE id = ?', [id]);
    return rows.length ? mapProcess(rows[0]) : null;
  },
  forGoal: (goalId: string, activeOnly = false): Process[] =>
    db
      .query<SqlRow>(
        `SELECT * FROM process WHERE monthly_goal_id = ? ${activeOnly ? 'AND active = 1' : ''} ORDER BY position, created_at`,
        [goalId],
      )
      .map(mapProcess),
  forGoals(goalIds: string[], activeOnly = true): Process[] {
    if (!goalIds.length) return [];
    return db
      .query<SqlRow>(
        `SELECT * FROM process WHERE monthly_goal_id IN (${goalIds.map(() => '?').join(',')})
         ${activeOnly ? 'AND active = 1' : ''} ORDER BY position, created_at`,
        goalIds,
      )
      .map(mapProcess);
  },
  create(d: ProcessDraft): Process {
    const now = nowIso();
    const p: Process = { ...d, id: uid(), createdAt: now, updatedAt: now };
    db.run(
      `INSERT INTO process (id, monthly_goal_id, name, description, link, weight, target_value, unit, position, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.monthlyGoalId, p.name, p.description, p.link, p.weight, p.targetValue, p.unit, p.position, b(p.active), now, now],
    );
    return p;
  },
  update(id: string, patch: Partial<Process>): void {
    const cur = processRepo.byId(id);
    if (!cur) return;
    const n = { ...cur, ...patch };
    db.run(
      `UPDATE process SET name = ?, description = ?, link = ?, weight = ?, target_value = ?, unit = ?,
       position = ?, active = ?, updated_at = ? WHERE id = ?`,
      [n.name, n.description, n.link, n.weight, n.targetValue, n.unit, n.position, b(n.active), nowIso(), id],
    );
  },
  delete: (id: string): void => db.run('DELETE FROM process WHERE id = ?', [id]),
};

// --- daily executions ------------------------------------------------------------------

const mapExec = (r: SqlRow): DailyExecution => ({
  id: str(r, 'id'),
  processId: str(r, 'process_id'),
  date: str(r, 'date'),
  completed: bool(r, 'completed'),
  actualValue: numOrNull(r, 'actual_value'),
  score: num(r, 'score'),
  note: str(r, 'note'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export const execRepo = {
  forDate: (date: string): DailyExecution[] =>
    db.query<SqlRow>('SELECT * FROM daily_execution WHERE date = ?', [date]).map(mapExec),
  forProcessAndDate(processId: string, date: string): DailyExecution | null {
    const rows = db.query<SqlRow>('SELECT * FROM daily_execution WHERE process_id = ? AND date = ?', [processId, date]);
    return rows.length ? mapExec(rows[0]) : null;
  },
  forProcess: (processId: string, limit = 60): DailyExecution[] =>
    db
      .query<SqlRow>('SELECT * FROM daily_execution WHERE process_id = ? ORDER BY date DESC LIMIT ?', [processId, limit])
      .map(mapExec),
  forProcessesInRange(ids: string[], start: string, end: string): DailyExecution[] {
    if (!ids.length) return [];
    return db
      .query<SqlRow>(
        `SELECT * FROM daily_execution WHERE process_id IN (${ids.map(() => '?').join(',')})
         AND date BETWEEN ? AND ? ORDER BY date`,
        [...ids, start, end],
      )
      .map(mapExec);
  },
  upsert(processId: string, date: string, patch: Partial<DailyExecution>): void {
    const existing = execRepo.forProcessAndDate(processId, date);
    const now = nowIso();
    if (existing) {
      const n = { ...existing, ...patch };
      db.run(
        'UPDATE daily_execution SET completed = ?, actual_value = ?, score = ?, note = ?, updated_at = ? WHERE id = ?',
        [b(n.completed), n.actualValue, n.score, n.note, now, existing.id],
      );
      return;
    }
    db.run(
      `INSERT INTO daily_execution (id, process_id, date, completed, actual_value, score, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), processId, date, b(patch.completed ?? false), patch.actualValue ?? null, patch.score ?? 0, patch.note ?? '', now, now],
    );
  },
};

// --- daily scores ------------------------------------------------------------------

const mapScore = (r: SqlRow): DailyScore => ({
  id: str(r, 'id'),
  date: str(r, 'date'),
  score: num(r, 'score'),
  isMinimumViableDay: bool(r, 'is_minimum_viable_day'),
  isFreezeDay: bool(r, 'is_freeze_day'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export const scoreRepo = {
  forDate(date: string): DailyScore | null {
    const rows = db.query<SqlRow>('SELECT * FROM daily_score WHERE date = ?', [date]);
    return rows.length ? mapScore(rows[0]) : null;
  },
  inRange: (start: string, end: string): DailyScore[] =>
    db.query<SqlRow>('SELECT * FROM daily_score WHERE date BETWEEN ? AND ? ORDER BY date', [start, end]).map(mapScore),
  all: (): DailyScore[] => db.query<SqlRow>('SELECT * FROM daily_score ORDER BY date').map(mapScore),
  upsert(date: string, patch: Partial<DailyScore>): void {
    const existing = scoreRepo.forDate(date);
    const now = nowIso();
    if (existing) {
      const n = { ...existing, ...patch };
      db.run(
        'UPDATE daily_score SET score = ?, is_minimum_viable_day = ?, is_freeze_day = ?, updated_at = ? WHERE date = ?',
        [n.score, b(n.isMinimumViableDay), b(n.isFreezeDay), now, date],
      );
      return;
    }
    db.run(
      `INSERT INTO daily_score (id, date, score, is_minimum_viable_day, is_freeze_day, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid(), date, patch.score ?? 0, b(patch.isMinimumViableDay ?? false), b(patch.isFreezeDay ?? false), now, now],
    );
  },
};

// --- streak (singleton row) ------------------------------------------------------------

export const streakRepo = {
  get(): Streak {
    const rows = db.query<SqlRow>('SELECT * FROM streak WHERE id = 1');
    if (!rows.length) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeDaysUsed: 0, freezeDaysAvailable: 2, updatedAt: '' };
    }
    const r = rows[0];
    return {
      currentStreak: num(r, 'current_streak'),
      longestStreak: num(r, 'longest_streak'),
      lastActiveDate: strOrNull(r, 'last_active_date'),
      freezeDaysUsed: num(r, 'freeze_days_used'),
      freezeDaysAvailable: num(r, 'freeze_days_available'),
      updatedAt: str(r, 'updated_at'),
    };
  },
  save(s: Streak): void {
    db.run(
      `INSERT INTO streak (id, current_streak, longest_streak, last_active_date, freeze_days_used, freeze_days_available, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
         last_active_date = excluded.last_active_date, freeze_days_used = excluded.freeze_days_used,
         freeze_days_available = excluded.freeze_days_available, updated_at = excluded.updated_at`,
      [s.currentStreak, s.longestStreak, s.lastActiveDate, s.freezeDaysUsed, s.freezeDaysAvailable, nowIso()],
    );
  },
};

// --- settings (key/value) ------------------------------------------------------------

export const DEFAULT_SETTINGS: AppSettings = {
  accent: '#7c5cff',
  theme: 'auto',
  minimumViableDay: 30,
  freezeDaysAvailable: 2,
  seeded: false,
};

export const settingsRepo = {
  getAll(): AppSettings {
    const map = new Map(db.query<SqlRow>('SELECT key, value FROM setting').map((r) => [str(r, 'key'), str(r, 'value')]));
    return {
      accent: map.get('accent') ?? DEFAULT_SETTINGS.accent,
      theme: (map.get('theme') as ThemeMode | undefined) ?? DEFAULT_SETTINGS.theme,
      minimumViableDay: Number(map.get('minimumViableDay') ?? DEFAULT_SETTINGS.minimumViableDay),
      freezeDaysAvailable: Number(map.get('freezeDaysAvailable') ?? DEFAULT_SETTINGS.freezeDaysAvailable),
      seeded: map.get('seeded') === '1',
    };
  },
  set: (key: string, value: string): void =>
    db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]),
};

// --- weekly reflections ------------------------------------------------------------

const mapReflection = (r: SqlRow): WeeklyReflection => ({
  id: str(r, 'id'),
  weekStart: str(r, 'week_start'),
  weekEnd: str(r, 'week_end'),
  whatWentWell: str(r, 'what_went_well'),
  whatDidntGoWell: str(r, 'what_didnt_go_well'),
  whatToChange: str(r, 'what_to_change'),
  previousActionItemsReviewed: bool(r, 'previous_action_items_reviewed'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

const mapItem = (r: SqlRow): ActionItem => ({
  id: str(r, 'id'),
  reflectionId: str(r, 'reflection_id'),
  text: str(r, 'text'),
  status: str(r, 'status') as ActionItemStatus,
  position: num(r, 'position'),
  createdAt: str(r, 'created_at'),
  updatedAt: str(r, 'updated_at'),
});

export interface ReflectionInput {
  whatWentWell: string;
  whatDidntGoWell: string;
  whatToChange: string;
  previousActionItemsReviewed: boolean;
  actionItems: { id?: string; text: string; status: ActionItemStatus }[];
}

export const reflectionRepo = {
  byWeekStart(weekStart: string): WeeklyReflectionWithItems | null {
    const rows = db.query<SqlRow>('SELECT * FROM weekly_reflection WHERE week_start = ?', [weekStart]);
    if (!rows.length) return null;
    const r = mapReflection(rows[0]);
    const items = db
      .query<SqlRow>('SELECT * FROM action_item WHERE reflection_id = ? ORDER BY position, created_at', [r.id])
      .map(mapItem);
    return { ...r, actionItems: items };
  },
  isCompleted: (weekStart: string): boolean =>
    db.query<SqlRow>('SELECT 1 FROM weekly_reflection WHERE week_start = ? LIMIT 1', [weekStart]).length > 0,
  /** Update the action-item statuses of an existing reflection (used when reviewing them a week later). */
  setItemStatus: (itemId: string, status: ActionItemStatus): void =>
    db.run('UPDATE action_item SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), itemId]),
  save(weekStart: string, input: ReflectionInput): void {
    const now = nowIso();
    const existing = reflectionRepo.byWeekStart(weekStart);
    db.transaction(() => {
      let id: string;
      if (existing) {
        id = existing.id;
        db.run(
          `UPDATE weekly_reflection SET what_went_well = ?, what_didnt_go_well = ?, what_to_change = ?,
           previous_action_items_reviewed = ?, updated_at = ? WHERE id = ?`,
          [input.whatWentWell, input.whatDidntGoWell, input.whatToChange, b(input.previousActionItemsReviewed), now, id],
        );
        db.run('DELETE FROM action_item WHERE reflection_id = ?', [id]);
      } else {
        id = uid();
        db.run(
          `INSERT INTO weekly_reflection (id, week_start, week_end, what_went_well, what_didnt_go_well, what_to_change,
           previous_action_items_reviewed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, weekStart, weekEndOf(weekStart), input.whatWentWell, input.whatDidntGoWell, input.whatToChange,
            b(input.previousActionItemsReviewed), now, now],
        );
      }
      input.actionItems
        .filter((it) => it.text.trim())
        .forEach((it, i) =>
          db.run(
            `INSERT INTO action_item (id, reflection_id, text, status, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uid(), id, it.text.trim(), it.status, i, now, now],
          ),
        );
    });
  },
};
