import { Injectable } from '@angular/core';
import { DailyExecution, Process, ScoreBand } from '../models';

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

/**
 * Central scoring rules. Pure functions only — no persistence — so the behaviour
 * is trivially testable and identical everywhere it is used.
 *
 *  - A process is *binary* when targetValue <= 1, else *quantitative*.
 *  - Process contribution = weight * completionRatio        (0 .. weight)
 *  - Goal day score        = sum of its process contributions (weights total 100 => 0 .. 100)
 *  - Daily score           = mean of the day's goal scores   (0 .. 100)
 */
@Injectable({ providedIn: 'root' })
export class ScoringService {
  isQuantitative(process: Process): boolean {
    return process.targetValue > 1;
  }

  /** 0..1 share of a process considered done on a day. */
  completionRatio(process: Process, execution: DailyExecution | null | undefined): number {
    if (!execution) return 0;
    if (this.isQuantitative(process)) {
      const actual =
        execution.actualValue ?? (execution.completed ? process.targetValue : 0);
      return clamp01(actual / process.targetValue);
    }
    return execution.completed ? 1 : 0;
  }

  /** Points a process earned on a day (0..process.weight). */
  contribution(process: Process, execution: DailyExecution | null | undefined): number {
    return round1(process.weight * this.completionRatio(process, execution));
  }

  /** 0..100 execution of a single goal on a single day. */
  goalDayScore(processes: Process[], executions: DailyExecution[]): number {
    const active = processes.filter((p) => p.active);
    if (!active.length) return 0;
    const byProcess = index(executions);
    const total = active.reduce(
      (sum, p) => sum + this.contribution(p, byProcess.get(p.id) ?? null),
      0,
    );
    return clampScore(total);
  }

  /**
   * 0..100 overall score for a day: the weighted sum of each goal's day score by
   * its share of the month. If no goal carries a weight (legacy data), the goals
   * are averaged equally so the score is still meaningful.
   */
  dailyScore(goals: GoalExecutionInput[]): number {
    const scored = goals
      .filter((g) => g.processes.some((p) => p.active))
      .map((g) => ({
        score: this.goalDayScore(g.processes, g.executions),
        weight: Math.max(0, g.weight ?? 0),
      }));
    if (!scored.length) return 0;

    const totalWeight = scored.reduce((sum, g) => sum + g.weight, 0);
    if (totalWeight <= 0) {
      return clampScore(scored.reduce((sum, g) => sum + g.score, 0) / scored.length);
    }
    return clampScore(
      scored.reduce((sum, g) => sum + g.score * (g.weight / totalWeight), 0),
    );
  }

  /** Mean of a numeric series, 0 when empty. */
  mean(values: number[]): number {
    if (!values.length) return 0;
    return round1(values.reduce((a, b) => a + b, 0) / values.length);
  }

  band(score: number): ScoreBand {
    if (score <= 0) return 'void';
    if (score < 40) return 'low';
    if (score < 65) return 'mid';
    if (score < 85) return 'good';
    return 'high';
  }
}

function index(executions: DailyExecution[]): Map<string, DailyExecution> {
  const m = new Map<string, DailyExecution>();
  for (const e of executions) m.set(e.processId, e);
  return m;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
