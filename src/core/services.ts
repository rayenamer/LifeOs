/**
 * Use-case layer — the same behaviour as the Angular services, as plain functions.
 * Every write goes through `sqlite.run`, which bumps the change bus so React re-renders.
 */
import { sqlite } from '../db/sqlite';
import type { ActionItemStatus, AppSettings, LifeArea, MonthKey, MonthlyGoal, Process, Streak, ThemeMode } from './models';
import {
  areaRepo,
  DEFAULT_SETTINGS,
  execRepo,
  goalRepo,
  ProcessDraft,
  processRepo,
  ReflectionInput,
  reflectionRepo,
  scoreRepo,
  settingsRepo,
  streakRepo,
} from './repos';
import { GoalExecutionInput, scoring } from './scoring';
import { streakCalc } from './streak';
import { addDays, isoWeekNumber, monthOf, today, weekEndOf, weekStartOf } from './date';

// --- settings ------------------------------------------------------------------

export const settings = {
  get: (): AppSettings => settingsRepo.getAll(),
  mvd: (): number => settingsRepo.getAll().minimumViableDay,

  /** Push accent + theme into CSS custom properties. */
  apply(): void {
    const s = settingsRepo.getAll();
    applyAccent(s.accent);
    applyTheme(s.theme);
  },
  setAccent(hex: string): void {
    settingsRepo.set('accent', hex);
    applyAccent(hex);
  },
  setTheme(mode: ThemeMode): void {
    settingsRepo.set('theme', mode);
    applyTheme(mode);
  },
  setMinimumViableDay(points: number): void {
    settingsRepo.set('minimumViableDay', String(Math.max(0, Math.min(100, Math.round(points)))));
    consistency.recompute();
  },
  setFreezeDaysAvailable(count: number): void {
    const n = Math.max(0, Math.round(count));
    settingsRepo.set('freezeDaysAvailable', String(n));
    streakRepo.save({ ...streakRepo.get(), freezeDaysAvailable: n });
  },
  async wipeAllData(): Promise<void> {
    await sqlite.reset();
    applyAccent(DEFAULT_SETTINGS.accent);
    applyTheme(DEFAULT_SETTINGS.theme);
  },
};

function applyAccent(hex: string): void {
  const el = document.documentElement;
  el.style.setProperty('--accent', hex);
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (m) {
    const rgb = `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
    el.style.setProperty('--accent-rgb', rgb);
  }
}

function applyTheme(mode: ThemeMode): void {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
}

// --- consistency: streak + freeze days ------------------------------------------

export const consistency = {
  /** Recompute currentStreak / longestStreak / lastActiveDate from daily scores (never destructive). */
  recompute(): Streak {
    const computed = streakCalc.compute(scoreRepo.all(), settings.mvd());
    const current = streakRepo.get();
    const next: Streak = {
      ...current,
      currentStreak: computed.currentStreak,
      longestStreak: Math.max(computed.longestStreak, current.longestStreak),
      lastActiveDate: computed.lastActiveDate,
    };
    streakRepo.save(next);
    return next;
  },

  canFreeze(date: string): boolean {
    if (streakRepo.get().freezeDaysAvailable <= 0) return false;
    const existing = scoreRepo.forDate(date);
    if (existing?.isFreezeDay) return false;
    if (existing && existing.score >= settings.mvd()) return false; // already a valid day
    return date <= today();
  },

  /** A freeze protects consistency without pretending the processes were done. */
  useFreezeDay(date: string): boolean {
    if (!consistency.canFreeze(date)) return false;
    sqlite.transaction(() => {
      const existing = scoreRepo.forDate(date);
      scoreRepo.upsert(date, { score: existing?.score ?? 0, isFreezeDay: true, isMinimumViableDay: false });
      const s = streakRepo.get();
      streakRepo.save({ ...s, freezeDaysAvailable: s.freezeDaysAvailable - 1, freezeDaysUsed: s.freezeDaysUsed + 1 });
      consistency.recompute();
    });
    return true;
  },

  removeFreezeDay(date: string): void {
    const existing = scoreRepo.forDate(date);
    if (!existing?.isFreezeDay) return;
    sqlite.transaction(() => {
      scoreRepo.upsert(date, { score: existing.score, isFreezeDay: false });
      const s = streakRepo.get();
      streakRepo.save({ ...s, freezeDaysAvailable: s.freezeDaysAvailable + 1, freezeDaysUsed: Math.max(0, s.freezeDaysUsed - 1) });
      consistency.recompute();
    });
  },
};

// --- execution: the daily loop ------------------------------------------------

function blankExecution(processId: string, date: string) {
  return { id: '', processId, date, completed: false, actualValue: null as number | null, score: 0, note: '', createdAt: '', updatedAt: '' };
}

export const execution = {
  toggleProcess(processId: string, date: string): void {
    const p = processRepo.byId(processId);
    if (!p) return;
    const current = execRepo.forProcessAndDate(processId, date);
    const completed = !(current?.completed ?? false);
    const actualValue = completed && scoring.isQuantitative(p) ? p.targetValue : null;
    const score = scoring.contribution(p, { ...blankExecution(processId, date), completed, actualValue });
    sqlite.transaction(() => {
      execRepo.upsert(processId, date, { completed, actualValue, score, note: current?.note ?? '' });
      execution.recalcDay(date);
    });
  },

  setActualValue(processId: string, date: string, value: number): void {
    const p = processRepo.byId(processId);
    if (!p) return;
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    const completed = safe >= p.targetValue;
    const score = scoring.contribution(p, { ...blankExecution(processId, date), completed, actualValue: safe });
    sqlite.transaction(() => {
      execRepo.upsert(processId, date, { actualValue: safe, completed, score });
      execution.recalcDay(date);
    });
  },

  setNote: (processId: string, date: string, note: string): void => execRepo.upsert(processId, date, { note }),

  /** Recompute the DailyScore row for a date from all of that month's goals. */
  recalcDay(date: string): number {
    const dayExecs = execRepo.forDate(date);
    const inputs: GoalExecutionInput[] = goalRepo.forMonth(monthOf(date)).map((g) => ({
      processes: processRepo.forGoal(g.id, true),
      executions: dayExecs,
      weight: g.weight,
    }));
    const score = scoring.dailyScore(inputs);
    const existing = scoreRepo.forDate(date);
    scoreRepo.upsert(date, {
      score,
      isMinimumViableDay: score >= settings.mvd(),
      isFreezeDay: existing?.isFreezeDay ?? false,
    });
    consistency.recompute();
    return score;
  },
};

// --- goals, processes, life areas ----------------------------------------------

export interface ProcessSpec {
  id?: string;
  name: string;
  description: string;
  link: string;
  weight: number;
  targetValue: number;
  unit: string;
}

export const sumWeights = (specs: { weight: number }[]): number => specs.reduce((s, x) => s + (Number(x.weight) || 0), 0);
export const weightsValid = (specs: { weight: number }[]): boolean => specs.length > 0 && sumWeights(specs) === 100;

function specToDraft(goalId: string, spec: ProcessSpec, position: number): ProcessDraft {
  return {
    monthlyGoalId: goalId,
    name: spec.name.trim(),
    description: spec.description.trim(),
    link: spec.link.trim(),
    weight: Math.round(Number(spec.weight) || 0),
    targetValue: Math.max(1, Number(spec.targetValue) || 1),
    unit: spec.unit.trim(),
    position,
    active: true,
  };
}

/** Re-score the elapsed days of a month after its structure changed. */
function recalcMonth(month: MonthKey): void {
  const cur = monthOf(today());
  const start = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
  if (start > today()) return;
  const end = month.year === cur.year && month.month === cur.month ? today() : addDays(start, 27);
  for (let d = start; d <= end; d = addDays(d, 1)) execution.recalcDay(d);
}

export const goals = {
  areas: (): LifeArea[] => areaRepo.all(),

  createArea: (name: string, description = '', icon = ''): LifeArea => areaRepo.create({ name, description, icon }),
  updateArea: (id: string, patch: Partial<LifeArea>): void => areaRepo.update(id, patch),

  /** Sum of every goal's weight in a month (optionally excluding one goal). */
  monthWeightTotal: (month: MonthKey, excludeGoalId?: string): number =>
    goalRepo.forMonth(month).filter((g) => g.id !== excludeGoalId).reduce((s, g) => s + (g.weight || 0), 0),

  hasGoalFor: (areaId: string, month: MonthKey): boolean => !!goalRepo.forAreaAndMonth(areaId, month),

  setGoalWeights(month: MonthKey, entries: { id: string; weight: number }[]): void {
    sqlite.transaction(() => {
      for (const e of entries) goalRepo.update(e.id, { weight: Math.max(0, Math.round(Number(e.weight) || 0)) });
      recalcMonth(month);
    });
  },

  /** Process weights must total exactly 100; the goal's own weight must not push the month over 100. */
  createGoal(input: { lifeAreaId: string; month: MonthKey; title: string; description: string; weight: number; processes: ProcessSpec[] }): MonthlyGoal {
    if (!weightsValid(input.processes)) throw new Error('Process weights must total exactly 100.');
    const weight = Math.max(0, Math.round(Number(input.weight) || 0));
    if (goals.monthWeightTotal(input.month) + weight > 100) {
      throw new Error('This goal would push the month past 100. Lower its weight first.');
    }
    if (goals.hasGoalFor(input.lifeAreaId, input.month)) {
      throw new Error('This life area already has a goal that month — one goal per area per month.');
    }
    let goal!: MonthlyGoal;
    sqlite.transaction(() => {
      goal = goalRepo.create({
        lifeAreaId: input.lifeAreaId,
        year: input.month.year,
        month: input.month.month,
        title: input.title.trim(),
        description: input.description.trim(),
        weight,
        isDemo: false,
      });
      input.processes.forEach((spec, i) => processRepo.create(specToDraft(goal.id, spec, i)));
      recalcMonth(input.month);
    });
    return goal;
  },

  updateGoal(goalId: string, patch: { title?: string; description?: string; weight?: number }): void {
    sqlite.transaction(() => {
      goalRepo.update(goalId, patch);
      const g = goalRepo.byId(goalId);
      if (g) recalcMonth(g);
    });
  },

  deleteGoal(goalId: string): void {
    const g = goalRepo.byId(goalId);
    sqlite.transaction(() => {
      goalRepo.delete(goalId);
      if (g) recalcMonth(g);
    });
  },

  /** Replace the whole process set for a goal (used by the goal editor). */
  replaceProcesses(goalId: string, specs: ProcessSpec[]): void {
    if (!weightsValid(specs)) throw new Error('Process weights must total exactly 100.');
    sqlite.transaction(() => {
      const keep = new Set(specs.filter((s) => s.id).map((s) => s.id));
      for (const p of processRepo.forGoal(goalId)) if (!keep.has(p.id)) processRepo.delete(p.id);
      specs.forEach((spec, i) => {
        if (spec.id) {
          const d = specToDraft(goalId, spec, i);
          processRepo.update(spec.id, { ...d, active: processRepo.byId(spec.id)?.active ?? true });
        } else {
          processRepo.create(specToDraft(goalId, spec, i));
        }
      });
      const g = goalRepo.byId(goalId);
      if (g) recalcMonth(g);
    });
  },

  processesForGoal: (goalId: string): Process[] => processRepo.forGoal(goalId),
};

// --- weekly reflection -----------------------------------------------------------

export interface WeekRef {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  isCurrent: boolean;
  completed: boolean;
  avgScore: number;
}

export const weeks = {
  currentWeekStart: (): string => weekStartOf(today()),

  /** Recent weeks, newest first, including the current one. */
  recent(count = 10): WeekRef[] {
    const out: WeekRef[] = [];
    let ws = weeks.currentWeekStart();
    for (let i = 0; i < count; i++) {
      out.push(weeks.describe(ws));
      ws = addDays(ws, -7);
    }
    return out;
  },

  describe(weekStart: string): WeekRef {
    const weekEnd = weekEndOf(weekStart);
    const scores = scoreRepo.inRange(weekStart, weekEnd).filter((s) => s.date <= today());
    return {
      weekStart,
      weekEnd,
      weekNumber: isoWeekNumber(weekStart),
      isCurrent: weekStart === weeks.currentWeekStart(),
      completed: reflectionRepo.isCompleted(weekStart),
      avgScore: scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0,
    };
  },

  get: (weekStart: string) => reflectionRepo.byWeekStart(weekStart),
  previousActionItems: (weekStart: string) => reflectionRepo.byWeekStart(addDays(weekStart, -7))?.actionItems ?? [],
  setItemStatus: (itemId: string, status: ActionItemStatus) => reflectionRepo.setItemStatus(itemId, status),
  save: (weekStart: string, input: ReflectionInput) => reflectionRepo.save(weekStart, input),
};
