import { Injectable, inject } from '@angular/core';
import { ActionItem, WeeklyReflection, WeeklyReflectionWithItems } from '../models';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import {
  ReflectionInput,
  WeeklyReflectionRepository,
} from '../repositories/weekly-reflection.repository';
import { addDays, isoWeekNumber, today, weekEndOf, weekStartOf } from '../util/date';
import { StateBus } from './state-bus.service';

export interface WeekRef {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  isCurrent: boolean;
  completed: boolean;
  avgScore: number;
}

@Injectable({ providedIn: 'root' })
export class WeekService {
  private repo = inject(WeeklyReflectionRepository);
  private scores = inject(DailyScoreRepository);
  private bus = inject(StateBus);

  currentWeekStart(): string {
    return weekStartOf(today());
  }

  /** Recent weeks, newest first, including the current one. */
  recentWeeks(count = 10): WeekRef[] {
    const out: WeekRef[] = [];
    let ws = this.currentWeekStart();
    for (let i = 0; i < count; i++) {
      out.push(this.describe(ws));
      ws = addDays(ws, -7);
    }
    return out;
  }

  describe(weekStart: string): WeekRef {
    const weekEnd = weekEndOf(weekStart);
    const scores = this.scores
      .inRange(weekStart, weekEnd)
      .filter((s) => s.date <= today());
    const avg = scores.length
      ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
      : 0;
    return {
      weekStart,
      weekEnd,
      weekNumber: isoWeekNumber(weekStart),
      isCurrent: weekStart === this.currentWeekStart(),
      completed: this.repo.isCompleted(weekStart),
      avgScore: avg,
    };
  }

  get(weekStart: string): WeeklyReflectionWithItems | null {
    return this.repo.byWeekStart(weekStart);
  }

  previousActionItems(weekStart: string): ActionItem[] {
    const prevStart = addDays(weekStart, -7);
    const prev = this.repo.byWeekStart(prevStart);
    return prev?.actionItems ?? [];
  }

  save(weekStart: string, input: ReflectionInput): WeeklyReflection {
    const saved = this.repo.save(weekStart, input);
    this.bus.bump();
    return saved;
  }
}
