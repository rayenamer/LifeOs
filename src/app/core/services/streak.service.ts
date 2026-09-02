import { Injectable } from '@angular/core';
import { DailyScore } from '../models';
import { addDays, today } from '../util/date';

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
 * viable day threshold. The current streak is never destroyed by history: a
 * single missed day resets `currentStreak` to 0 but `longestStreak` and every
 * past record are preserved. Today never counts against the user until it ends.
 */
@Injectable({ providedIn: 'root' })
export class StreakService {
  isActiveDay(score: DailyScore | null | undefined, minimumViableDay: number): boolean {
    if (!score) return false;
    return score.isFreezeDay || score.score >= minimumViableDay;
  }

  compute(
    scores: DailyScore[],
    minimumViableDay: number,
    now: string = today(),
  ): StreakComputation {
    const active = new Set(
      scores.filter((s) => this.isActiveDay(s, minimumViableDay)).map((s) => s.date),
    );
    const recorded = scores.map((s) => s.date).sort();

    // longest run of consecutive calendar days
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of [...active].sort()) {
      run = prev && d === addDays(prev, 1) ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }

    // current streak: walk back from today (or yesterday if today isn't active yet)
    let cursor = active.has(now) ? now : addDays(now, -1);
    let current = 0;
    while (active.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }

    const lastActiveDate = [...active].sort().pop() ?? null;

    // missed days: recorded days in the past that never became active
    const missedDays = recorded.filter((d) => d < now && !active.has(d)).length;

    return {
      currentStreak: current,
      longestStreak: Math.max(longest, current),
      lastActiveDate,
      activeDays: active.size,
      missedDays,
    };
  }
}
