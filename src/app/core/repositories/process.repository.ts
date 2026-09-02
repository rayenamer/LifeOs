import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { Process } from '../models';
import { nowIso } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, str } from '../util/row';

function map(row: SqlRow): Process {
  return {
    id: str(row, 'id'),
    monthlyGoalId: str(row, 'monthly_goal_id'),
    name: str(row, 'name'),
    description: str(row, 'description'),
    weight: num(row, 'weight'),
    targetValue: num(row, 'target_value'),
    unit: str(row, 'unit'),
    position: num(row, 'position'),
    active: bool(row, 'active'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

export type ProcessDraft = Omit<Process, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class ProcessRepository {
  private db = inject(SqliteService);

  byId(id: string): Process | null {
    const rows = this.db.query<SqlRow>('SELECT * FROM process WHERE id = ?', [id]);
    return rows.length ? map(rows[0]) : null;
  }

  forGoal(goalId: string, activeOnly = false): Process[] {
    const where = activeOnly ? 'AND active = 1' : '';
    return this.db
      .query<SqlRow>(
        `SELECT * FROM process WHERE monthly_goal_id = ? ${where} ORDER BY position, created_at`,
        [goalId],
      )
      .map(map);
  }

  forGoals(goalIds: string[], activeOnly = true): Process[] {
    if (!goalIds.length) return [];
    const placeholders = goalIds.map(() => '?').join(',');
    const where = activeOnly ? 'AND active = 1' : '';
    return this.db
      .query<SqlRow>(
        `SELECT * FROM process WHERE monthly_goal_id IN (${placeholders}) ${where}
         ORDER BY position, created_at`,
        goalIds,
      )
      .map(map);
  }

  create(draft: ProcessDraft): Process {
    const now = nowIso();
    const p: Process = { ...draft, id: uid(), createdAt: now, updatedAt: now };
    this.db.run(
      `INSERT INTO process
        (id, monthly_goal_id, name, description, weight, target_value, unit, position, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.monthlyGoalId, p.name, p.description, p.weight, p.targetValue, p.unit, p.position, b(p.active), now, now],
    );
    return p;
  }

  update(id: string, patch: Partial<Process>): void {
    const cur = this.byId(id);
    if (!cur) return;
    const n = { ...cur, ...patch };
    this.db.run(
      `UPDATE process SET name = ?, description = ?, weight = ?, target_value = ?, unit = ?,
        position = ?, active = ?, updated_at = ? WHERE id = ?`,
      [n.name, n.description, n.weight, n.targetValue, n.unit, n.position, b(n.active), nowIso(), id],
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM process WHERE id = ?', [id]);
  }
}
