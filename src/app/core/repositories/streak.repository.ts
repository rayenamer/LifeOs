import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { Streak } from '../models';
import { nowIso } from '../util/date';
import { num, strOrNull } from '../util/row';

function map(row: SqlRow): Streak {
  return {
    currentStreak: num(row, 'current_streak'),
    longestStreak: num(row, 'longest_streak'),
    lastActiveDate: strOrNull(row, 'last_active_date'),
    freezeDaysUsed: num(row, 'freeze_days_used'),
    freezeDaysAvailable: num(row, 'freeze_days_available'),
    updatedAt: nowIso(),
  };
}

const EMPTY: Streak = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  freezeDaysUsed: 0,
  freezeDaysAvailable: 2,
  updatedAt: '',
};

@Injectable({ providedIn: 'root' })
export class StreakRepository {
  private db = inject(SqliteService);

  get(): Streak {
    const rows = this.db.query<SqlRow>('SELECT * FROM streak WHERE id = 1');
    return rows.length ? map(rows[0]) : { ...EMPTY };
  }

  save(s: Streak): void {
    this.db.run(
      `INSERT INTO streak (id, current_streak, longest_streak, last_active_date,
         freeze_days_used, freeze_days_available, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         current_streak = excluded.current_streak,
         longest_streak = excluded.longest_streak,
         last_active_date = excluded.last_active_date,
         freeze_days_used = excluded.freeze_days_used,
         freeze_days_available = excluded.freeze_days_available,
         updated_at = excluded.updated_at`,
      [
        s.currentStreak,
        s.longestStreak,
        s.lastActiveDate,
        s.freezeDaysUsed,
        s.freezeDaysAvailable,
        nowIso(),
      ],
    );
  }
}
