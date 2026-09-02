import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { DailyExecution } from '../models';
import { nowIso } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, numOrNull, str } from '../util/row';

function map(row: SqlRow): DailyExecution {
  return {
    id: str(row, 'id'),
    processId: str(row, 'process_id'),
    date: str(row, 'date'),
    completed: bool(row, 'completed'),
    actualValue: numOrNull(row, 'actual_value'),
    score: num(row, 'score'),
    note: str(row, 'note'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

@Injectable({ providedIn: 'root' })
export class DailyExecutionRepository {
  private db = inject(SqliteService);

  forDate(date: string): DailyExecution[] {
    return this.db
      .query<SqlRow>('SELECT * FROM daily_execution WHERE date = ?', [date])
      .map(map);
  }

  forProcessAndDate(processId: string, date: string): DailyExecution | null {
    const rows = this.db.query<SqlRow>(
      'SELECT * FROM daily_execution WHERE process_id = ? AND date = ?',
      [processId, date],
    );
    return rows.length ? map(rows[0]) : null;
  }

  forProcess(processId: string, limit = 60): DailyExecution[] {
    return this.db
      .query<SqlRow>(
        'SELECT * FROM daily_execution WHERE process_id = ? ORDER BY date DESC LIMIT ?',
        [processId, limit],
      )
      .map(map);
  }

  forProcessesInRange(processIds: string[], start: string, end: string): DailyExecution[] {
    if (!processIds.length) return [];
    const ph = processIds.map(() => '?').join(',');
    return this.db
      .query<SqlRow>(
        `SELECT * FROM daily_execution WHERE process_id IN (${ph}) AND date BETWEEN ? AND ?
         ORDER BY date`,
        [...processIds, start, end],
      )
      .map(map);
  }

  /** Insert or update the row for (process, date). */
  upsert(processId: string, date: string, patch: Partial<DailyExecution>): DailyExecution {
    const existing = this.forProcessAndDate(processId, date);
    const now = nowIso();
    if (existing) {
      const n = { ...existing, ...patch };
      this.db.run(
        `UPDATE daily_execution SET completed = ?, actual_value = ?, score = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        [b(n.completed), n.actualValue, n.score, n.note, now, existing.id],
      );
      return { ...n, updatedAt: now };
    }
    const row: DailyExecution = {
      id: uid(),
      processId,
      date,
      completed: patch.completed ?? false,
      actualValue: patch.actualValue ?? null,
      score: patch.score ?? 0,
      note: patch.note ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO daily_execution
        (id, process_id, date, completed, actual_value, score, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, processId, date, b(row.completed), row.actualValue, row.score, row.note, now, now],
    );
    return row;
  }

  hasAnyForDate(date: string): boolean {
    const rows = this.db.query<SqlRow>(
      'SELECT 1 FROM daily_execution WHERE date = ? LIMIT 1',
      [date],
    );
    return rows.length > 0;
  }

  /** Every distinct date that has at least one execution. */
  distinctDates(): string[] {
    return this.db
      .query<SqlRow>('SELECT DISTINCT date FROM daily_execution ORDER BY date')
      .map((r) => str(r, 'date'));
  }
}
