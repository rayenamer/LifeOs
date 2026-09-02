import { SqlRow } from '../database/sqlite.service';

export function str(row: SqlRow, key: string): string {
  const v = row[key];
  return v == null ? '' : String(v);
}

export function strOrNull(row: SqlRow, key: string): string | null {
  const v = row[key];
  return v == null ? null : String(v);
}

export function num(row: SqlRow, key: string): number {
  const v = row[key];
  return typeof v === 'number' ? v : v == null ? 0 : Number(v);
}

export function numOrNull(row: SqlRow, key: string): number | null {
  const v = row[key];
  return v == null ? null : Number(v);
}

export function bool(row: SqlRow, key: string): boolean {
  return num(row, key) !== 0;
}

export const b = (v: boolean): number => (v ? 1 : 0);
