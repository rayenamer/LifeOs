import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { DailyScore } from '../models';
import { nowIso } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, str } from '../util/row';

function map(row: SqlRow): DailyScore {
  return {
    id: str(row, 'id'),
    date: str(row, 'date'),
    score: num(row, 'score'),
    isMinimumViableDay: bool(row, 'is_minimum_viable_day'),
    isFreezeDay: bool(row, 'is_freeze_day'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

@Injectable({ providedIn: 'root' })
export class DailyScoreRepository {
  private db = inject(SqliteService);

  forDate(date: string): DailyScore | null {
    const rows = this.db.query<SqlRow>('SELECT * FROM daily_score WHERE date = ?', [date]);
    return rows.length ? map(rows[0]) : null;
  }

  inRange(start: string, end: string): DailyScore[] {
    return this.db
      .query<SqlRow>('SELECT * FROM daily_score WHERE date BETWEEN ? AND ? ORDER BY date', [start, end])
      .map(map);
  }

  all(): DailyScore[] {
    return this.db.query<SqlRow>('SELECT * FROM daily_score ORDER BY date').map(map);
  }

  earliestDate(): string | null {
    const rows = this.db.query<SqlRow>('SELECT MIN(date) AS d FROM daily_score');
    return rows.length && rows[0]['d'] != null ? str(rows[0], 'd') : null;
  }

  upsert(date: string, patch: Partial<DailyScore>): DailyScore {
    const existing = this.forDate(date);
    const now = nowIso();
    if (existing) {
      const n = { ...existing, ...patch };
      this.db.run(
        `UPDATE daily_score SET score = ?, is_minimum_viable_day = ?, is_freeze_day = ?, updated_at = ?
         WHERE date = ?`,
        [n.score, b(n.isMinimumViableDay), b(n.isFreezeDay), now, date],
      );
      return { ...n, updatedAt: now };
    }
    const row: DailyScore = {
      id: uid(),
      date,
      score: patch.score ?? 0,
      isMinimumViableDay: patch.isMinimumViableDay ?? false,
      isFreezeDay: patch.isFreezeDay ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO daily_score
        (id, date, score, is_minimum_viable_day, is_freeze_day, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, date, row.score, b(row.isMinimumViableDay), b(row.isFreezeDay), now, now],
    );
    return row;
  }
}
