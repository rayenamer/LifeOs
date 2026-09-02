import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { MonthKey, MonthlyGoal } from '../models';
import { nowIso } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, str } from '../util/row';

function map(row: SqlRow): MonthlyGoal {
  return {
    id: str(row, 'id'),
    lifeAreaId: str(row, 'life_area_id'),
    year: num(row, 'year'),
    month: num(row, 'month'),
    title: str(row, 'title'),
    description: str(row, 'description'),
    weight: num(row, 'weight'),
    isDemo: bool(row, 'is_demo'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

@Injectable({ providedIn: 'root' })
export class MonthlyGoalRepository {
  private db = inject(SqliteService);

  all(): MonthlyGoal[] {
    return this.db
      .query<SqlRow>('SELECT * FROM monthly_goal ORDER BY year DESC, month DESC')
      .map(map);
  }

  byId(id: string): MonthlyGoal | null {
    const rows = this.db.query<SqlRow>('SELECT * FROM monthly_goal WHERE id = ?', [id]);
    return rows.length ? map(rows[0]) : null;
  }

  forMonth({ year, month }: MonthKey): MonthlyGoal[] {
    return this.db
      .query<SqlRow>(
        `SELECT g.* FROM monthly_goal g
         JOIN life_area a ON a.id = g.life_area_id
         WHERE g.year = ? AND g.month = ?
         ORDER BY a.position, a.name`,
        [year, month],
      )
      .map(map);
  }

  forAreaAndMonth(lifeAreaId: string, { year, month }: MonthKey): MonthlyGoal | null {
    const rows = this.db.query<SqlRow>(
      'SELECT * FROM monthly_goal WHERE life_area_id = ? AND year = ? AND month = ?',
      [lifeAreaId, year, month],
    );
    return rows.length ? map(rows[0]) : null;
  }

  distinctMonths(): MonthKey[] {
    return this.db
      .query<SqlRow>('SELECT DISTINCT year, month FROM monthly_goal ORDER BY year DESC, month DESC')
      .map((r) => ({ year: num(r, 'year'), month: num(r, 'month') }));
  }

  create(data: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>): MonthlyGoal {
    const now = nowIso();
    const goal: MonthlyGoal = { ...data, id: uid(), createdAt: now, updatedAt: now };
    this.db.run(
      `INSERT INTO monthly_goal
        (id, life_area_id, year, month, title, description, weight, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.id,
        goal.lifeAreaId,
        goal.year,
        goal.month,
        goal.title,
        goal.description,
        Math.round(goal.weight) || 0,
        b(goal.isDemo),
        now,
        now,
      ],
    );
    return goal;
  }

  update(id: string, patch: Partial<Pick<MonthlyGoal, 'title' | 'description' | 'weight'>>): void {
    const cur = this.byId(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    this.db.run(
      'UPDATE monthly_goal SET title = ?, description = ?, weight = ?, updated_at = ? WHERE id = ?',
      [next.title, next.description, Math.round(next.weight) || 0, nowIso(), id],
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM monthly_goal WHERE id = ?', [id]);
  }
}
