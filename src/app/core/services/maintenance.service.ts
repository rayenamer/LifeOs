import { Injectable, inject } from '@angular/core';
import { SqliteService } from '../database/sqlite.service';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { LifeAreaRepository } from '../repositories/life-area.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { ConsistencyService } from './consistency.service';
import { ExecutionService } from './execution.service';
import { StateBus } from './state-bus.service';

/** Destructive housekeeping: remove seeded demo data without touching real data. */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private db = inject(SqliteService);
  private areas = inject(LifeAreaRepository);
  private execs = inject(DailyExecutionRepository);
  private settingsRepo = inject(SettingsRepository);
  private execution = inject(ExecutionService);
  private consistency = inject(ConsistencyService);
  private bus = inject(StateBus);

  hasDemoData(): boolean {
    return this.areas.all().some((a) => a.isDemo);
  }

  /**
   * Delete every demo life area (goals, processes and executions cascade), then
   * rebuild daily scores from whatever real executions remain.
   */
  deleteDemoData(): void {
    const demo = this.areas.all().filter((a) => a.isDemo);
    if (!demo.length) return;

    this.db.transaction(() => {
      for (const a of demo) this.areas.delete(a.id);
      // wipe every score row; they are re-derived below from surviving executions
      this.db.run('DELETE FROM daily_score');
    });

    for (const d of this.execs.distinctDates()) this.execution.recalcDay(d);

    this.settingsRepo.set('seeded', '0');
    this.consistency.recompute();
    this.consistency.refresh();
    this.bus.bump();
  }
}
