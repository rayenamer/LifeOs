import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SqliteService } from '../../core/database/sqlite.service';
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

    <section class="panel block">
      <h2 class="section-title">DATA VAULT</h2>
      <p class="hint">
        Your database lives in this browser. Link it to a file on your disk and every change is
        also written there — an ordinary <span class="mono">lifeos.sqlite</span> you can back up,
        sync, or copy to another machine.
      </p>

      @if (vaultSupported) {
        @if (vault.linked()) {
          <div class="vault-status ok">
            <div>
              <span class="d-title mono">{{ vault.fileName() }}</span>
              <p class="hint">
                Auto-saving to disk.
                @if (vault.lastSavedAt(); as t) { Last write {{ savedAgo(t) }}. }
              </p>
            </div>
            <div class="vault-actions">
              <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="reloadFromFile()">
                RELOAD FROM FILE
              </button>
              <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="disconnect()">
                DISCONNECT
              </button>
            </div>
          </div>
        } @else if (vault.needsReconnect()) {
          <div class="vault-status warn">
            <div>
              <span class="d-title mono">{{ vault.fileName() }}</span>
              <p class="hint">
                Access needs to be re-granted after a browser restart. Until then, changes are
                saved in this browser only.
              </p>
            </div>
            <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="reconnect()">
              RECONNECT
            </button>
          </div>
        } @else {
          <div class="vault-actions">
            <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="linkNew()">
              SAVE MY DATA TO A FILE…
            </button>
            <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="linkExisting()">
              OPEN AN EXISTING FILE…
            </button>
          </div>
        }
      } @else {
        <p class="hint warn-text">
          This browser can't auto-save to a file. Use <span class="mono">EXPORT</span> regularly and
          keep the copy somewhere safe. (Brave, Chrome and Edge support auto-save.)
        </p>
      }

      <div class="vault-actions bordered">
        <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="exportFile()">
          EXPORT
        </button>
        <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="importInput.click()">
          IMPORT
        </button>
        <input
          #importInput
          type="file"
          accept=".sqlite,.db,.sqlite3,application/x-sqlite3"
          hidden
          (change)="onImportPicked($event)"
        />
      </div>

      @if (notice(); as n) { <p class="hint notice">{{ n }}</p> }
    </section>

    <section class="panel block danger-zone">
      <h2 class="section-title">DATA</h2>
      <div class="data-row">
        <div>
          <span class="d-title">Everything</span>
          <p class="hint">Erase all goals, executions, scores, reflections and settings. Cannot be undone.</p>
        </div>
        <button class="btn btn--danger" type="button" (click)="confirmWipe.set(true)">RESET SYSTEM</button>
      </div>
    </section>

    <ui-confirm-dialog
      [open]="confirmWipe()"
      title="Reset the entire system?"
      message="Every goal, execution, score and reflection will be permanently deleted."
      confirmLabel="RESET EVERYTHING"
      [danger]="true"
      (confirm)="wipe()"
      (cancel)="confirmWipe.set(false)"
    />

    <ui-confirm-dialog
      [open]="confirmAdopt()"
      title="That file already has a database"
      message="Open it and use it from now on? What's currently on screen will be replaced — a backup stays in this browser."
      confirmLabel="OPEN THAT FILE"
      (confirm)="adoptExisting()"
      (cancel)="cancelAdopt()"
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
      .vault-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding: var(--s-3) var(--s-4);
        border: 1px solid var(--border);
        border-radius: var(--r-2);
        flex-wrap: wrap;
      }
      .vault-status.ok { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
      .vault-status.warn { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); }
      .vault-actions { display: flex; gap: var(--s-3); flex-wrap: wrap; }
      .vault-actions.bordered { border-top: 1px solid var(--border); padding-top: var(--s-3); margin-top: var(--s-1); }
      .warn-text { color: color-mix(in srgb, var(--danger) 70%, var(--text-2)); }
      .notice { color: var(--text-1); }
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
  private bus = inject(StateBus);
  private router = inject(Router);
  private sqlite = inject(SqliteService);

  protected readonly vault = this.sqlite.vault;
  protected readonly vaultSupported = this.vault.supported;

  readonly accents = ACCENTS;
  readonly confirmWipe = signal(false);
  readonly confirmAdopt = signal(false);
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);

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

  async wipe(): Promise<void> {
    await this.settingsSvc.wipeAllData();
    this.confirmWipe.set(false);
    void this.router.navigate(['/app/months']);
  }

  // --- data vault ---------------------------------------------------------

  async linkNew(): Promise<void> {
    await this.run(async () => {
      const result = await this.sqlite.linkVaultSaveTarget();
      if (result === 'existing-data') {
        this.confirmAdopt.set(true);
      } else if (result === 'linked') {
        this.notice.set('Linked. Your data is now also saved to that file on every change.');
      }
    });
  }

  cancelAdopt(): void {
    this.confirmAdopt.set(false);
    // The picker already remembered the file; drop it so we never overwrite
    // that existing database with what's currently on screen.
    void this.sqlite.disconnectVault();
    this.notice.set('Left that file untouched. Nothing is linked.');
  }

  async adoptExisting(): Promise<void> {
    this.confirmAdopt.set(false);
    await this.run(async () => {
      await this.sqlite.adoptVaultFile();
      this.reload();
    });
  }

  async linkExisting(): Promise<void> {
    await this.run(async () => {
      const result = await this.sqlite.linkVaultExistingFile();
      if (result === 'linked') this.reload();
    });
  }

  async reloadFromFile(): Promise<void> {
    await this.run(async () => {
      await this.sqlite.adoptVaultFile();
      this.reload();
    });
  }

  async reconnect(): Promise<void> {
    await this.run(async () => {
      const ok = await this.sqlite.reconnectVault();
      this.notice.set(
        ok ? 'Reconnected. Auto-save to disk is back on.' : 'Access was not granted.',
      );
    });
  }

  async disconnect(): Promise<void> {
    await this.run(async () => {
      await this.sqlite.disconnectVault();
      this.notice.set('Disconnected. Data is still saved in this browser.');
    });
  }

  exportFile(): void {
    const bytes = this.sqlite.exportBytes();
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async onImportPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.sqlite.importBytes(bytes);
      this.reload();
    });
  }

  private async run(work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.notice.set(null);
    try {
      await work();
    } catch (err) {
      this.notice.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  private reload(): void {
    // A full database swap — reload so every view re-reads from scratch.
    window.location.assign('/app/months');
  }

  savedAgo(ts: number): string {
    const secs = Math.round((Date.now() - ts) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }
}
