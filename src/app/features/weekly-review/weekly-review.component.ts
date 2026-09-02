import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActionItemStatus } from '../../core/models';
import { StateBus } from '../../core/services/state-bus.service';
import { WeekService } from '../../core/services/week.service';
import { isoWeekNumber } from '../../core/util/date';
import { WeekRangePipe } from '../../shared/pipes/pipes';

interface ItemDraft {
  key: string;
  text: string;
  status: ActionItemStatus;
}

@Component({
  selector: 'app-weekly-review',
  standalone: true,
  imports: [FormsModule, RouterLink, WeekRangePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <a routerLink="/app/reflection" class="back mono">← ALL WEEKS</a>
      <span class="eyebrow">WEEK {{ weekNumber() }} · {{ weekStart() | weekRange }}</span>
      <h1>{{ existing() ? 'Review your reflection' : 'Reflect on the week' }}</h1>
    </header>

    @if (previousItems().length) {
      <section class="panel block last-week">
        <h2 class="section-title">LAST WEEK'S ACTION ITEMS</h2>
        <ul class="prev-list">
          @for (it of previousItems(); track it.id) {
            <li>
              <span class="p-status mono" [class.done]="it.status === 'done'">{{ it.status.toUpperCase() }}</span>
              {{ it.text }}
            </li>
          }
        </ul>
        <label class="checkline">
          <input type="checkbox" [(ngModel)]="reviewed" />
          <span>I reviewed last week's action items</span>
        </label>
      </section>
    }

    <section class="panel block">
      <div class="field">
        <label for="ww">WHAT WENT WELL</label>
        <textarea id="ww" class="textarea" [(ngModel)]="wentWell" placeholder="Processes that held. Conditions that helped."></textarea>
      </div>
      <div class="field">
        <label for="wd">WHAT DIDN'T GO WELL</label>
        <textarea id="wd" class="textarea" [(ngModel)]="didntGoWell" placeholder="Where execution slipped, and why."></textarea>
      </div>
      <div class="field">
        <label for="wc">WHAT TO CHANGE</label>
        <textarea id="wc" class="textarea" [(ngModel)]="toChange" placeholder="One concrete adjustment to the system."></textarea>
      </div>
    </section>

    <section class="panel block">
      <h2 class="section-title">ACTION ITEMS · 1–3 FOR NEXT WEEK</h2>
      @for (it of items(); track it.key; let i = $index) {
        <div class="item-row">
          <input class="input" [(ngModel)]="it.text" placeholder="A specific, controllable change" />
          <select class="input status-sel" [(ngModel)]="it.status">
            <option value="open">OPEN</option>
            <option value="done">DONE</option>
            <option value="carried">CARRIED</option>
          </select>
          <button class="btn btn--danger rm" type="button" (click)="removeItem(i)" aria-label="Remove item">✕</button>
        </div>
      }
      @if (items().length < 3) {
        <button class="btn add" type="button" (click)="addItem()">+ ADD ITEM</button>
      }
    </section>

    <div class="actions">
      <span class="hint mono" [class.bad]="!valid()">
        {{ valid() ? 'READY TO SAVE' : 'ADD AT LEAST ONE NOTE OR ACTION ITEM' }}
      </span>
      <button class="btn btn--primary" type="button" [disabled]="!valid()" (click)="save()">
        {{ existing() ? 'UPDATE REFLECTION' : 'SAVE REFLECTION' }}
      </button>
    </div>
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-5); }
      .back { font-size: 10px; letter-spacing: 0.16em; color: var(--text-2); }
      .back:hover { color: var(--accent); }
      h1 { font-size: clamp(20px, 3.6vw, 28px); }
      .block { padding: var(--s-5); margin-bottom: var(--s-4); display: flex; flex-direction: column; gap: var(--s-4); }
      .last-week .prev-list { display: flex; flex-direction: column; gap: var(--s-2); font-size: 13px; color: var(--text-1); }
      .prev-list li { display: flex; gap: var(--s-3); align-items: baseline; }
      .p-status {
        font-size: 9px;
        letter-spacing: 0.14em;
        color: var(--text-3);
        border: 1px solid var(--border-1);
        border-radius: var(--r-1);
        padding: 1px 5px;
        flex-shrink: 0;
      }
      .p-status.done { color: var(--score-high); border-color: var(--score-high); }
      .checkline { display: flex; align-items: center; gap: var(--s-2); font-size: 12px; color: var(--text-1); }
      .item-row { display: grid; grid-template-columns: 1fr auto auto; gap: var(--s-2); }
      .status-sel { width: 108px; font-family: var(--font-mono); font-size: 11px; }
      .rm { padding: 8px 10px; }
      .add { align-self: flex-start; }
      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--s-4);
        margin-top: var(--s-4);
      }
      .hint { font-size: 10px; letter-spacing: 0.14em; color: var(--text-2); }
      .hint.bad { color: var(--danger); }
      @media (max-width: 560px) {
        .item-row { grid-template-columns: 1fr auto; }
        .item-row .input:first-child { grid-column: 1 / -1; }
      }
    `,
  ],
})
export class WeeklyReviewComponent {
  private week = inject(WeekService);
  private bus = inject(StateBus);
  private router = inject(Router);

  readonly weekStart = input.required<string>();

  readonly wentWell = signal('');
  readonly didntGoWell = signal('');
  readonly toChange = signal('');
  readonly reviewed = signal(false);
  readonly items = signal<ItemDraft[]>([]);

  private loadedFor = '';

  constructor() {
    effect(() => {
      this.bus.revision();
      const ws = this.weekStart();
      this.hydrate(ws);
    });
  }

  readonly weekNumber = computed(() => isoWeekNumber(this.weekStart()));

  readonly existing = computed(() => {
    this.bus.revision();
    return !!this.week.get(this.weekStart());
  });

  readonly previousItems = computed(() => {
    this.bus.revision();
    return this.week.previousActionItems(this.weekStart());
  });

  readonly valid = computed(
    () =>
      this.wentWell().trim().length > 0 ||
      this.didntGoWell().trim().length > 0 ||
      this.toChange().trim().length > 0 ||
      this.items().some((i) => i.text.trim().length > 0),
  );

  private hydrate(ws: string): void {
    if (this.loadedFor === ws) return;
    this.loadedFor = ws;
    const r = this.week.get(ws);
    if (r) {
      this.wentWell.set(r.whatWentWell);
      this.didntGoWell.set(r.whatDidntGoWell);
      this.toChange.set(r.whatToChange);
      this.reviewed.set(r.previousActionItemsReviewed);
      this.items.set(
        r.actionItems.map((it, i) => ({ key: `${it.id}-${i}`, text: it.text, status: it.status })),
      );
    } else {
      this.wentWell.set('');
      this.didntGoWell.set('');
      this.toChange.set('');
      this.reviewed.set(false);
      this.items.set([{ key: 'i0', text: '', status: 'open' }]);
    }
  }

  addItem(): void {
    this.items.update((is) => [...is, { key: `i${Date.now()}`, text: '', status: 'open' }]);
  }

  removeItem(i: number): void {
    this.items.update((is) => is.filter((_, idx) => idx !== i));
  }

  save(): void {
    if (!this.valid()) return;
    this.week.save(this.weekStart(), {
      whatWentWell: this.wentWell().trim(),
      whatDidntGoWell: this.didntGoWell().trim(),
      whatToChange: this.toChange().trim(),
      previousActionItemsReviewed: this.reviewed(),
      actionItems: this.items()
        .filter((i) => i.text.trim().length > 0)
        .map((i) => ({ text: i.text.trim(), status: i.status })),
    });
    void this.router.navigate(['/app/reflection']);
  }
}
