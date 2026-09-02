import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { ActionItem, ActionItemStatus, WeeklyReflection, WeeklyReflectionWithItems } from '../models';
import { nowIso, weekEndOf } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, str } from '../util/row';

function mapReflection(row: SqlRow): WeeklyReflection {
  return {
    id: str(row, 'id'),
    weekStart: str(row, 'week_start'),
    weekEnd: str(row, 'week_end'),
    whatWentWell: str(row, 'what_went_well'),
    whatDidntGoWell: str(row, 'what_didnt_go_well'),
    whatToChange: str(row, 'what_to_change'),
    previousActionItemsReviewed: bool(row, 'previous_action_items_reviewed'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

function mapItem(row: SqlRow): ActionItem {
  return {
    id: str(row, 'id'),
    reflectionId: str(row, 'reflection_id'),
    text: str(row, 'text'),
    status: str(row, 'status') as ActionItemStatus,
    position: num(row, 'position'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

export interface ReflectionInput {
  whatWentWell: string;
  whatDidntGoWell: string;
  whatToChange: string;
  previousActionItemsReviewed: boolean;
  actionItems: { id?: string; text: string; status: ActionItemStatus }[];
}

@Injectable({ providedIn: 'root' })
export class WeeklyReflectionRepository {
  private db = inject(SqliteService);

  all(): WeeklyReflection[] {
    return this.db
      .query<SqlRow>('SELECT * FROM weekly_reflection ORDER BY week_start DESC')
      .map(mapReflection);
  }

  byWeekStart(weekStart: string): WeeklyReflectionWithItems | null {
    const rows = this.db.query<SqlRow>(
      'SELECT * FROM weekly_reflection WHERE week_start = ?',
      [weekStart],
    );
    if (!rows.length) return null;
    const reflection = mapReflection(rows[0]);
    return { ...reflection, actionItems: this.itemsFor(reflection.id) };
  }

  itemsFor(reflectionId: string): ActionItem[] {
    return this.db
      .query<SqlRow>(
        'SELECT * FROM action_item WHERE reflection_id = ? ORDER BY position, created_at',
        [reflectionId],
      )
      .map(mapItem);
  }

  openItemsBefore(weekStart: string): ActionItem[] {
    return this.db
      .query<SqlRow>(
        `SELECT i.* FROM action_item i
         JOIN weekly_reflection r ON r.id = i.reflection_id
         WHERE r.week_start < ?
         ORDER BY r.week_start DESC, i.position`,
        [weekStart],
      )
      .map(mapItem);
  }

  isCompleted(weekStart: string): boolean {
    return this.db.query<SqlRow>(
      'SELECT 1 FROM weekly_reflection WHERE week_start = ? LIMIT 1',
      [weekStart],
    ).length > 0;
  }

  save(weekStart: string, input: ReflectionInput): WeeklyReflectionWithItems {
    const now = nowIso();
    const weekEnd = weekEndOf(weekStart);
    const existing = this.byWeekStart(weekStart);

    this.db.transaction(() => {
      let reflectionId: string;
      if (existing) {
        reflectionId = existing.id;
        this.db.run(
          `UPDATE weekly_reflection SET what_went_well = ?, what_didnt_go_well = ?, what_to_change = ?,
             previous_action_items_reviewed = ?, updated_at = ? WHERE id = ?`,
          [
            input.whatWentWell,
            input.whatDidntGoWell,
            input.whatToChange,
            b(input.previousActionItemsReviewed),
            now,
            reflectionId,
          ],
        );
        this.db.run('DELETE FROM action_item WHERE reflection_id = ?', [reflectionId]);
      } else {
        reflectionId = uid();
        this.db.run(
          `INSERT INTO weekly_reflection
            (id, week_start, week_end, what_went_well, what_didnt_go_well, what_to_change,
             previous_action_items_reviewed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reflectionId,
            weekStart,
            weekEnd,
            input.whatWentWell,
            input.whatDidntGoWell,
            input.whatToChange,
            b(input.previousActionItemsReviewed),
            now,
            now,
          ],
        );
      }

      input.actionItems
        .filter((it) => it.text.trim().length > 0)
        .forEach((it, i) => {
          this.db.run(
            `INSERT INTO action_item (id, reflection_id, text, status, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uid(), reflectionId, it.text.trim(), it.status, i, now, now],
          );
        });
    });

    return this.byWeekStart(weekStart)!;
  }
}
