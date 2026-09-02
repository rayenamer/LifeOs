import { Injectable, computed, inject, signal } from '@angular/core';
import { SqliteService } from '../database/sqlite.service';
import { AppSettings } from '../models';
import { SettingsRepository } from '../repositories/settings.repository';
import { StreakRepository } from '../repositories/streak.repository';
import { StateBus } from './state-bus.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private repo = inject(SettingsRepository);
  private streakRepo = inject(StreakRepository);
  private db = inject(SqliteService);
  private bus = inject(StateBus);

  private readonly _settings = signal<AppSettings>({
    accent: '#00f0ff',
    minimumViableDay: 30,
    freezeDaysAvailable: 2,
    seeded: false,
  });

  readonly settings = this._settings.asReadonly();
  readonly minimumViableDay = computed(() => this._settings().minimumViableDay);
  readonly accent = computed(() => this._settings().accent);

  /** Called once after the database is ready. */
  load(): void {
    const s = this.repo.getAll();
    this._settings.set(s);
    this.applyAccent(s.accent);
  }

  setAccent(hex: string): void {
    this.repo.set('accent', hex);
    this._settings.update((s) => ({ ...s, accent: hex }));
    this.applyAccent(hex);
    this.bus.bump();
  }

  setMinimumViableDay(points: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(points)));
    this.repo.set('minimumViableDay', String(clamped));
    this._settings.update((s) => ({ ...s, minimumViableDay: clamped }));
    this.bus.bump();
  }

  setFreezeDaysAvailable(count: number): void {
    const n = Math.max(0, Math.round(count));
    this.repo.set('freezeDaysAvailable', String(n));
    const streak = this.streakRepo.get();
    this.streakRepo.save({ ...streak, freezeDaysAvailable: n });
    this._settings.update((s) => ({ ...s, freezeDaysAvailable: n }));
    this.bus.bump();
  }

  private applyAccent(hex: string): void {
    const el = document.documentElement;
    el.style.setProperty('--accent', hex);
    const rgb = hexToRgb(hex);
    if (rgb) {
      el.style.setProperty('--accent-dim', `rgba(${rgb}, 0.14)`);
      el.style.setProperty('--accent-glow', `rgba(${rgb}, 0.35)`);
    }
  }

  async wipeAllData(): Promise<void> {
    await this.db.reset();
    this._settings.set({
      accent: '#00f0ff',
      minimumViableDay: 30,
      freezeDaysAvailable: 2,
      seeded: false,
    });
    this.applyAccent('#00f0ff');
    this.bus.bump();
  }
}

function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}
