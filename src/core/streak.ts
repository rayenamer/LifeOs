import type { DailyScore } from './models';
import { addDays, today } from './date';

export interface StreakComputation {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  activeDays: number;
  missedDays: number;
}

/**
 * Consistency, not perfection.
 *
 * A day is *active* when it is a freeze day OR its score reached the minimum
 * viable day threshold. A missed day resets `currentStreak` but never erases
 * `longestStreak` or history. Today never counts against the user until it ends.
 */
export const streakCalc = {
  isActiveDay: (s: DailyScore | null | undefined, mvd: number): boolean => !!s && (s.isFreezeDay || s.score >= mvd),

  compute(scores: DailyScore[], mvd: number, now: string = today()): StreakComputation {
    const active = new Set(scores.filter((s) => streakCalc.isActiveDay(s, mvd)).map((s) => s.date));
    const sortedActive = [...active].sort();

    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of sortedActive) {
      run = prev && d === addDays(prev, 1) ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }

    let cursor = active.has(now) ? now : addDays(now, -1);
    let current = 0;
    while (active.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }

    return {
      currentStreak: current,
      longestStreak: Math.max(longest, current),
      lastActiveDate: sortedActive.at(-1) ?? null,
      activeDays: active.size,
      missedDays: scores.filter((s) => s.date < now && !active.has(s.date)).length,
    };
  },
};
