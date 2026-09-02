import { Injectable, inject, signal } from '@angular/core';
import { Streak } from '../models';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import { StreakRepository } from '../repositories/streak.repository';
import { today } from '../util/date';
import { SettingsService } from './settings.service';
import { StateBus } from './state-bus.service';
import { StreakService } from './streak.service';

/**
 * Owns the streak record: recomputes it from history (never destructively) and
 * applies freeze days. A freeze protects consistency without pretending the
 * user completed their processes.
 */
@Injectable({ providedIn: 'root' })
export class ConsistencyService {
  private scores = inject(DailyScoreRepository);
  private streakRepo = inject(StreakRepository);
  private streakCalc = inject(StreakService);
  private settings = inject(SettingsService);
  private bus = inject(StateBus);

  private readonly _streak = signal<Streak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    freezeDaysUsed: 0,
    freezeDaysAvailable: 2,
    updatedAt: '',
  });
  readonly streak = this._streak.asReadonly();

  /** Load the persisted streak row. Safe to call only once the DB is ready. */
  refresh(): void {
    this._streak.set(this.streakRepo.get());
  }

  /** Recompute currentStreak / longestStreak / lastActiveDate from daily scores. */
  recompute(): Streak {
    const mvd = this.settings.minimumViableDay();
    const computed = this.streakCalc.compute(this.scores.all(), mvd);
    const current = this.streakRepo.get();
    const next: Streak = {
      ...current,
      currentStreak: computed.currentStreak,
      longestStreak: Math.max(computed.longestStreak, current.longestStreak),
      lastActiveDate: computed.lastActiveDate,
    };
    this.streakRepo.save(next);
    this._streak.set(next);
    return next;
  }

  canFreeze(date: string): boolean {
    const streak = this.streakRepo.get();
    if (streak.freezeDaysAvailable <= 0) return false;
    const existing = this.scores.forDate(date);
    if (existing?.isFreezeDay) return false;
    const mvd = this.settings.minimumViableDay();
    if (existing && existing.score >= mvd) return false; // already a valid day
    return date <= today();
  }

  useFreezeDay(date: string): boolean {
    if (!this.canFreeze(date)) return false;
    const existing = this.scores.forDate(date);
    this.scores.upsert(date, {
      score: existing?.score ?? 0,
      isFreezeDay: true,
      isMinimumViableDay: false,
    });
    const streak = this.streakRepo.get();
    this.streakRepo.save({
      ...streak,
      freezeDaysAvailable: streak.freezeDaysAvailable - 1,
      freezeDaysUsed: streak.freezeDaysUsed + 1,
    });
    this.recompute();
    this.bus.bump();
    return true;
  }

  removeFreezeDay(date: string): void {
    const existing = this.scores.forDate(date);
    if (!existing?.isFreezeDay) return;
    this.scores.upsert(date, { score: existing.score, isFreezeDay: false });
    const streak = this.streakRepo.get();
    this.streakRepo.save({
      ...streak,
      freezeDaysAvailable: streak.freezeDaysAvailable + 1,
      freezeDaysUsed: Math.max(0, streak.freezeDaysUsed - 1),
    });
    this.recompute();
    this.bus.bump();
  }
}
