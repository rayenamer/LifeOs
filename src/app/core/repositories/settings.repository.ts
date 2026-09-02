import { Injectable, inject } from '@angular/core';
import { SqliteService, SqlRow } from '../database/sqlite.service';
import { AppSettings } from '../models';

const DEFAULTS: AppSettings = {
  accent: '#00f0ff',
  minimumViableDay: 30,
  freezeDaysAvailable: 2,
  seeded: false,
};

@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  private db = inject(SqliteService);

  getAll(): AppSettings {
    const rows = this.db.query<SqlRow>('SELECT key, value FROM setting');
    const map = new Map(rows.map((r) => [String(r['key']), String(r['value'])]));
    return {
      accent: map.get('accent') ?? DEFAULTS.accent,
      minimumViableDay: Number(map.get('minimumViableDay') ?? DEFAULTS.minimumViableDay),
      freezeDaysAvailable: Number(map.get('freezeDaysAvailable') ?? DEFAULTS.freezeDaysAvailable),
      seeded: (map.get('seeded') ?? '') === '1',
    };
  }

  get(key: string): string | null {
    const rows = this.db.query<SqlRow>('SELECT value FROM setting WHERE key = ?', [key]);
    return rows.length ? String(rows[0]['value']) : null;
  }

  set(key: string, value: string): void {
    this.db.run(
      `INSERT INTO setting (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}
