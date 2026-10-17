import type { DailyExecution, Process, ScoreBand } from './models';

export interface GoalExecutionInput {
  processes: Process[];
  /** Executions for the day in question (any date, any process). */
  executions: DailyExecution[];
  /**
   * The goal's share of its month (0..100). All goals in a month sum to 100.
   * When every weight is 0 (legacy data), goals are averaged equally instead.
   */
  weight?: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;
const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Central scoring rules. Pure functions only, identical to the Angular LifeOS.
 *
 *  - A process is *binary* when targetValue <= 1, else *quantitative*.
 *  - Process contribution = weight * completionRatio        (0 .. weight)
 *  - Goal day score        = sum of its process contributions (weights total 100 => 0 .. 100)
 *  - Daily score           = goal day scores weighted by each goal's share of the month
 */
export const scoring = {
  isQuantitative: (p: Process): boolean => p.targetValue > 1,

  /** 0..1 share of a process considered done on a day. */
  completionRatio(p: Process, e: DailyExecution | null | undefined): number {
    if (!e) return 0;
    if (scoring.isQuantitative(p)) {
      const actual = e.actualValue ?? (e.completed ? p.targetValue : 0);
      return clamp01(actual / p.targetValue);
    }
    return e.completed ? 1 : 0;
  },

  /** Points a process earned on a day (0..process.weight). */
  contribution: (p: Process, e: DailyExecution | null | undefined): number =>
    round1(p.weight * scoring.completionRatio(p, e)),

  /** 0..100 execution of a single goal on a single day. */
  goalDayScore(processes: Process[], executions: DailyExecution[]): number {
    const active = processes.filter((p) => p.active);
    if (!active.length) return 0;
    const byProcess = new Map(executions.map((e) => [e.processId, e]));
    return clampScore(active.reduce((sum, p) => sum + scoring.contribution(p, byProcess.get(p.id)), 0));
  },

  dailyScore(goals: GoalExecutionInput[]): number {
    const scored = goals
      .filter((g) => g.processes.some((p) => p.active))
      .map((g) => ({ score: scoring.goalDayScore(g.processes, g.executions), weight: Math.max(0, g.weight ?? 0) }));
    if (!scored.length) return 0;
    const totalWeight = scored.reduce((s, g) => s + g.weight, 0);
    if (totalWeight <= 0) return clampScore(scored.reduce((s, g) => s + g.score, 0) / scored.length);
    return clampScore(scored.reduce((s, g) => s + g.score * (g.weight / totalWeight), 0));
  },

  band(score: number): ScoreBand {
    if (score <= 0) return 'void';
    if (score < 40) return 'low';
    if (score < 65) return 'mid';
    if (score < 85) return 'good';
    return 'high';
  },
};
