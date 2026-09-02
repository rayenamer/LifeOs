import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { LifeArea } from '../models';
import { nowIso } from '../util/date';
import { uid } from '../util/id';
import { b, bool, num, str } from '../util/row';

function map(row: SqlRow): LifeArea {
  return {
    id: str(row, 'id'),
    name: str(row, 'name'),
    description: str(row, 'description'),
    icon: str(row, 'icon'),
    position: num(row, 'position'),
    isDemo: bool(row, 'is_demo'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

@Injectable({ providedIn: 'root' })
export class LifeAreaRepository {
  private db = inject(SqliteService);

  all(): LifeArea[] {
    return this.db
      .query<SqlRow>('SELECT * FROM life_area ORDER BY position, name')
      .map(map);
  }

  byId(id: string): LifeArea | null {
    const rows = this.db.query<SqlRow>('SELECT * FROM life_area WHERE id = ?', [id]);
    return rows.length ? map(rows[0]) : null;
  }

  create(data: Partial<LifeArea> & { name: string }): LifeArea {
    const now = nowIso();
    const area: LifeArea = {
      id: uid(),
      name: data.name,
      description: data.description ?? '',
      icon: data.icon ?? '',
      position: data.position ?? this.all().length,
      isDemo: data.isDemo ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO life_area (id, name, description, icon, position, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [area.id, area.name, area.description, area.icon, area.position, b(area.isDemo), now, now],
    );
    return area;
  }

  update(id: string, patch: Partial<LifeArea>): void {
    const cur = this.byId(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    this.db.run(
      `UPDATE life_area SET name = ?, description = ?, icon = ?, position = ?, updated_at = ?
       WHERE id = ?`,
      [next.name, next.description, next.icon, next.position, nowIso(), id],
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM life_area WHERE id = ?', [id]);
  }
}
