import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { SettingsService } from '../../core/services/settings.service';
import { StateBus } from '../../core/services/state-bus.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

const ACCENTS = ['#00f0ff', '#7dff9b', '#ffd166', '#ff7ac6', '#9b8cff', '#ff6b57'];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <span class="eyebrow">SYSTEM</span>
      <h1>Settings</h1>
    </header>

    <section class="panel block">
      <h2 class="section-title">ACCENT</h2>
      <p class="hint">One restrained accent, used sparingly across the interface.</p>
      <div class="swatches">
        @for (c of accents; track c) {
          <button
            class="sw"
            type="button"
            [class.sel]="settings().accent.toLowerCase() === c"
            [style.background]="c"
            (click)="setAccent(c)"
            [attr.aria-label]="'Accent ' + c"
          ></button>
        }
        <label class="custom">
          <input type="color" [value]="settings().accent" (input)="setAccent($any($event.target).value)" />
          <span class="mono">CUSTOM</span>
        </label>
      </div>
    </section>

    <section class="panel block">
      <h2 class="section-title">MINIMUM VIABLE DAY</h2>
      <p class="hint">
        The score that makes a day count toward consistency. Consistency &gt; perfection —
        keep this reachable on a hard day.
      </p>
      <div class="slider-row">
        <input type="range" min="0" max="80" step="5" [ngModel]="settings().minimumViableDay" (ngModelChange)="setMvd($event)" />
        <span class="val mono">{{ settings().minimumViableDay }}</span>
      </div>
    </section>

    <section class="panel block">
      <h2 class="section-title">FREEZE DAYS</h2>
      <p class="hint">
        A freeze protects your consistency on a day you couldn't execute — without pretending
        the processes were done. It's visibly distinct everywhere it appears.
      </p>
      <div class="slider-row">
        <input type="range" min="0" max="8" step="1" [ngModel]="settings().freezeDaysAvailable" (ngModelChange)="setFreeze($event)" />
        <span class="val mono">{{ settings().freezeDaysAvailable }} AVAILABLE</span>
      </div>
    </section>

    <section class="panel block danger-zone">
      <h2 class="section-title">DATA</h2>
      @if (maintenance.hasDemoData()) {
        <div class="data-row">
          <div>
            <span class="d-title">Demo data</span>
            <p class="hint">Sample life areas and ~3 months of history, loaded on first launch.</p>
          </div>
          <button class="btn btn--danger" type="button" (click)="confirmDemo.set(true)">DELETE DEMO DATA</button>
        </div>
      }
      <div class="data-row">
        <div>
          <span class="d-title">Everything</span>
          <p class="hint">Erase all goals, executions, scores, reflections and settings. Cannot be undone.</p>
        </div>
        <button class="btn btn--danger" type="button" (click)="confirmWipe.set(true)">RESET SYSTEM</button>
      </div>
    </section>

    <ui-confirm-dialog
      [open]="confirmDemo()"
      title="Delete demo data?"
      message="The seeded life areas and their history will be removed. Anything you created yourself stays."
      confirmLabel="DELETE DEMO"
      [danger]="true"
      (confirm)="deleteDemo()"
      (cancel)="confirmDemo.set(false)"
    />
    <ui-confirm-dialog
      [open]="confirmWipe()"
      title="Reset the entire system?"
      message="Every goal, execution, score and reflection will be permanently deleted."
      confirmLabel="RESET EVERYTHING"
      [danger]="true"
      (confirm)="wipe()"
      (cancel)="confirmWipe.set(false)"
    />
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-6); }
      h1 { font-size: clamp(24px, 4vw, 32px); }
      .block { padding: var(--s-5); margin-bottom: var(--s-4); display: flex; flex-direction: column; gap: var(--s-3); }
      .hint { font-size: 12px; color: var(--text-2); line-height: 1.7; max-width: 60ch; }
      .swatches { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
      .sw {
        width: 30px;
        height: 30px;
        border-radius: var(--r-2);
        border: 1px solid var(--border-1);
        transition: transform var(--dur-1) var(--ease);
      }
      .sw:hover { transform: scale(1.08); }
      .sw.sel { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px currentColor; }
      .custom { display: inline-flex; align-items: center; gap: var(--s-2); }
      .custom input { width: 30px; height: 30px; background: none; border: none; padding: 0; }
      .custom span { font-size: 9px; color: var(--text-3); letter-spacing: 0.14em; }
      .slider-row { display: flex; align-items: center; gap: var(--s-4); }
      .slider-row input[type='range'] { flex: 1; accent-color: var(--accent); }
      .val { font-size: 13px; color: var(--text); letter-spacing: 0.1em; white-space: nowrap; }
      .data-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding: var(--s-3) 0;
        border-top: 1px solid var(--border);
        flex-wrap: wrap;
      }
      .data-row:first-of-type { border-top: none; }
      .d-title { font-size: 13px; color: var(--text); }
      .danger-zone { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
    `,
  ],
})
export class SettingsComponent {
  private settingsSvc = inject(SettingsService);
  protected maintenance = inject(MaintenanceService);
  private bus = inject(StateBus);
  private router = inject(Router);

  readonly accents = ACCENTS;
  readonly confirmDemo = signal(false);
  readonly confirmWipe = signal(false);

  readonly settings = computed(() => {
    this.bus.revision();
    return this.settingsSvc.settings();
  });

  setAccent(hex: string): void {
    this.settingsSvc.setAccent(hex);
  }

  setMvd(v: number): void {
    this.settingsSvc.setMinimumViableDay(Number(v));
  }

  setFreeze(v: number): void {
    this.settingsSvc.setFreezeDaysAvailable(Number(v));
  }

  deleteDemo(): void {
    this.maintenance.deleteDemoData();
    this.confirmDemo.set(false);
  }

  async wipe(): Promise<void> {
    await this.settingsSvc.wipeAllData();
    this.confirmWipe.set(false);
    void this.router.navigate(['/app/months']);
  }
}
