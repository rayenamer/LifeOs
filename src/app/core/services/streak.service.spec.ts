import { DailyScore } from '../models';
import { StreakService } from './streak.service';

function score(date: string, value: number, freeze = false): DailyScore {
  return {
    id: date,
    date,
    score: value,
    isMinimumViableDay: value >= 30,
    isFreezeDay: freeze,
    createdAt: '',
    updatedAt: '',
  };
}

describe('StreakService', () => {
  const svc = new StreakService();

  it('counts consecutive active days up to today', () => {
    const scores = [
      score('2026-08-30', 80),
      score('2026-08-31', 70),
      score('2026-09-01', 60),
    ];
    const r = svc.compute(scores, 30, '2026-09-01');
    expect(r.currentStreak).toBe(3);
    expect(r.longestStreak).toBe(3);
    expect(r.lastActiveDate).toBe('2026-09-01');
  });

  it('does not penalise an in-progress today with no score yet', () => {
    const scores = [score('2026-08-30', 80), score('2026-08-31', 70)];
    const r = svc.compute(scores, 30, '2026-09-01');
    expect(r.currentStreak).toBe(2);
  });

  it('breaks the current streak on a missed day but keeps the longest', () => {
    const scores = [
      score('2026-08-25', 90),
      score('2026-08-26', 90),
      score('2026-08-27', 90),
      score('2026-08-28', 10), // missed
      score('2026-08-31', 80),
      score('2026-09-01', 80),
    ];
    const r = svc.compute(scores, 30, '2026-09-01');
    expect(r.currentStreak).toBe(2);
    expect(r.longestStreak).toBe(3);
    expect(r.missedDays).toBe(1);
  });

  it('treats a freeze day as active', () => {
    const scores = [
      score('2026-08-30', 90),
      score('2026-08-31', 0, true),
      score('2026-09-01', 90),
    ];
    const r = svc.compute(scores, 30, '2026-09-01');
    expect(r.currentStreak).toBe(3);
  });
});
