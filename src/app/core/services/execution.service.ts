import { Injectable, inject } from '@angular/core';
import { GoalExecutionInput } from './scoring.service';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import { MonthlyGoalRepository } from '../repositories/monthly-goal.repository';
import { ProcessRepository } from '../repositories/process.repository';
import { monthOf } from '../util/date';
import { ConsistencyService } from './consistency.service';
import { ScoringService } from './scoring.service';
import { SettingsService } from './settings.service';
import { StateBus } from './state-bus.service';

/**
 * Fast daily execution: toggle a process, set a quantitative value, add a note.
 * Every change recomputes and persists that day's DailyScore and the streak.
 */
@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private processes = inject(ProcessRepository);
  private goals = inject(MonthlyGoalRepository);
  private execs = inject(DailyExecutionRepository);
  private scores = inject(DailyScoreRepository);
  private scoring = inject(ScoringService);
  private settings = inject(SettingsService);
  private consistency = inject(ConsistencyService);
  private bus = inject(StateBus);

  toggleProcess(processId: string, date: string): void {
    const process = this.processes.byId(processId);
    if (!process) return;
    const current = this.execs.forProcessAndDate(processId, date);
    const completed = !(current?.completed ?? false);
    const score = this.scoring.contribution(process, {
      ...blankExecution(processId, date),
      completed,
      actualValue: completed && this.scoring.isQuantitative(process) ? process.targetValue : null,
    });
    this.execs.upsert(processId, date, {
      completed,
      actualValue: completed && this.scoring.isQuantitative(process) ? process.targetValue : null,
      score,
      note: current?.note ?? '',
    });
    this.recalcDay(date);
  }

  setActualValue(processId: string, date: string, value: number): void {
    const process = this.processes.byId(processId);
    if (!process) return;
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    const completed = safe >= process.targetValue;
    const score = this.scoring.contribution(process, {
      ...blankExecution(processId, date),
      completed,
      actualValue: safe,
    });
    this.execs.upsert(processId, date, { actualValue: safe, completed, score });
    this.recalcDay(date);
  }

  setNote(processId: string, date: string, note: string): void {
    this.execs.upsert(processId, date, { note });
    this.bus.bump();
  }

  /** Recompute the DailyScore row for a date from all of that month's goals. */
  recalcDay(date: string): number {
    const mk = monthOf(date);
    const goals = this.goals.forMonth(mk);
    const dayExecs = this.execs.forDate(date);
    const inputs: GoalExecutionInput[] = goals.map((g) => ({
      processes: this.processes.forGoal(g.id, true),
      executions: dayExecs,
      weight: g.weight,
    }));
    const score = this.scoring.dailyScore(inputs);
    const mvd = this.settings.minimumViableDay();
    const existing = this.scores.forDate(date);
    this.scores.upsert(date, {
      score,
      isMinimumViableDay: score >= mvd,
      isFreezeDay: existing?.isFreezeDay ?? false,
    });
    this.consistency.recompute();
    this.bus.bump();
    return score;
  }
}

function blankExecution(processId: string, date: string) {
  return {
    id: '',
    processId,
    date,
    completed: false,
    actualValue: null as number | null,
    score: 0,
    note: '',
    createdAt: '',
    updatedAt: '',
  };
}
