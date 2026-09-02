import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GoalNode } from '../../core/models';
import { AnalyticsService } from '../../core/services/analytics.service';
import { GoalService } from '../../core/services/goal.service';
import { StateBus } from '../../core/services/state-bus.service';
import { ViewsService } from '../../core/services/views.service';
import { MONTH_NAMES, currentMonth } from '../../core/util/date';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { RadialConstellationComponent } from '../../shared/components/radial-constellation.component';
import { WeightBarComponent } from '../../shared/components/weight-bar.component';
import { ScoreColorPipe } from '../../shared/pipes/pipes';

interface WeightRow {
  id: string;
  name: string;
  area: string;
  weight: number;
}

@Component({
  selector: 'app-month-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    RadialConstellationComponent,
    WeightBarComponent,
    EmptyStateComponent,
    ScoreColorPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <a routerLink="/app/months" class="back mono">← ALL MONTHS</a>
      <div class="title-row">
        <div>
          <span class="eyebrow">MONTH DETAIL</span>
          <h1>{{ monthLabel() }} <span class="yr mono">{{ year() }}</span></h1>
        </div>
        <div class="score-block">
          <span class="s mono" [style.color]="monthScore() | scoreColor">{{ monthScore() }}</span>
          <span class="s-lbl mono">MONTH SCORE</span>
        </div>
      </div>
    </header>

    @if (!nodes().length) {
      <ui-empty-state
        eyebrow="NO GOALS THIS MONTH"
        title="THIS MONTH IS UNPLANNED."
        message="Add a monthly goal for a life area to start executing against it."
        actionLabel="CREATE A GOAL"
        actionLink="/app/goals/new"
      />
    } @else {
      <div class="constellation panel">
        <ui-radial-constellation
          [nodes]="nodes()"
          [centerLabel]="monthLabel().slice(0, 3)"
          [centerScore]="monthScore()"
          (pick)="open($event)"
        />
        <p class="hint mono">SELECT A LIFE AREA · RING = MONTH-TO-DATE · CORE DOT = TODAY</p>
      </div>

      <section class="panel alloc">
        <div class="alloc-head">
          <h2 class="section-title">GOAL WEIGHTS · SHARE OF THE MONTH</h2>
          <div class="alloc-actions">
            <span class="alloc-total mono" [class.bad]="!weightTotalValid()">
              {{ weightTotal() }} / 100
            </span>
            @if (!editing()) {
              <button class="btn btn--ghost" type="button" (click)="startEdit()">REBALANCE</button>
            } @else {
              <button class="btn btn--ghost" type="button" (click)="editing.set(false)">CANCEL</button>
              <button class="btn btn--primary" type="button" [disabled]="!editTotalValid()" (click)="save()">
                SAVE
              </button>
            }
          </div>
        </div>

        @if (!weightTotalValid() && !editing()) {
          <p class="alloc-warn mono">
            THIS MONTH ALLOCATES {{ weightTotal() }}, NOT 100 — SCORES ARE NORMALISED UNTIL YOU REBALANCE.
          </p>
        }

        @if (!editing()) {
          <div class="wlist">
            @for (n of nodes(); track n.goal.id) {
              <div class="wrow">
                <div class="wr-label">
                  <span class="wr-area mono">{{ n.area.name.toUpperCase() }}</span>
                  <span class="wr-goal">{{ n.goal.title }}</span>
                </div>
                <ui-weight-bar [weight]="n.goal.weight || 1" [ratio]="1" />
                <span class="wr-num mono">{{ n.goal.weight }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="wlist">
            @for (r of rows(); track r.id) {
              <div class="wrow edit">
                <div class="wr-label">
                  <span class="wr-area mono">{{ r.area.toUpperCase() }}</span>
                  <span class="wr-goal">{{ r.name }}</span>
                </div>
                <input class="input" type="number" min="0" max="100" [(ngModel)]="r.weight" />
              </div>
            }
          </div>
          <p class="alloc-hint mono" [class.bad]="!editTotalValid()">
            TOTAL {{ editTotal() }} / 100 — {{ editTotalValid() ? 'BALANCED' : 'MUST EQUAL 100 TO SAVE' }}
          </p>
        }
        <a class="btn add-goal" routerLink="/app/goals/new">+ ADD A GOAL TO THIS MONTH</a>
      </section>

      <div class="area-list">
        @for (n of nodes(); track n.goal.id) {
          <a class="area-row" [routerLink]="goalLink(n)">
            <div class="ar-main">
              <span class="ar-area mono">{{ n.area.name.toUpperCase() }} · WT {{ n.goal.weight }}</span>
              <span class="ar-goal">{{ n.goal.title }}</span>
            </div>
            <div class="ar-meta mono">
              <span>{{ n.processCount }} PROC</span>
              <span class="ar-score" [style.color]="n.score | scoreColor">{{ n.score }}</span>
            </div>
          </a>
        }
      </div>

      <div class="foot-actions">
        <a class="btn" [routerLink]="['/app/review', year(), month()]">MONTHLY REVIEW →</a>
      </div>
    }
  `,
  styles: [
    `
      .page-head {
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
        margin-bottom: var(--s-6);
      }
      .back {
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .back:hover {
        color: var(--accent);
      }
      .title-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-4);
        flex-wrap: wrap;
      }
      h1 {
        font-size: clamp(22px, 4vw, 30px);
      }
      .yr {
        color: var(--text-3);
        font-size: 0.6em;
      }
      .score-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .score-block .s {
        font-size: 34px;
        font-weight: 500;
        letter-spacing: -0.04em;
        line-height: 1;
      }
      .s-lbl {
        font-size: 9px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .constellation {
        padding: var(--s-6);
        margin-bottom: var(--s-5);
      }
      .hint {
        text-align: center;
        font-size: 9px;
        letter-spacing: 0.14em;
        color: var(--text-3);
        margin-top: var(--s-4);
      }
      .alloc {
        padding: var(--s-5);
        margin-bottom: var(--s-5);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
      }
      .alloc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        flex-wrap: wrap;
      }
      .alloc-actions {
        display: flex;
        align-items: center;
        gap: var(--s-3);
      }
      .alloc-total {
        font-size: 12px;
        letter-spacing: 0.14em;
        color: var(--text-1);
      }
      .alloc-total.bad {
        color: var(--danger);
      }
      .alloc-warn {
        font-size: 10px;
        letter-spacing: 0.1em;
        color: var(--danger);
      }
      .wlist {
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
      }
      .wrow {
        display: grid;
        grid-template-columns: 1.4fr 2fr auto;
        gap: var(--s-4);
        align-items: center;
      }
      .wrow.edit {
        grid-template-columns: 1fr auto;
      }
      .wr-label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .wr-area {
        font-size: 9px;
        letter-spacing: 0.14em;
        color: var(--text-2);
      }
      .wr-goal {
        font-size: 12px;
        color: var(--text);
      }
      .wrow .input {
        width: 76px;
        text-align: right;
      }
      .wr-num {
        font-size: 13px;
        color: var(--text);
      }
      .alloc-hint {
        font-size: 10px;
        letter-spacing: 0.14em;
        color: var(--text-2);
      }
      .alloc-hint.bad {
        color: var(--danger);
      }
      .add-goal {
        align-self: flex-start;
        font-size: 11px;
      }
      .area-list {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-radius: var(--r-3);
        overflow: hidden;
      }
      .area-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding: var(--s-4);
        border-bottom: 1px solid var(--border);
        transition: background var(--dur-1) var(--ease);
      }
      .area-row:last-child {
        border-bottom: none;
      }
      .area-row:hover {
        background: var(--surface-glass);
      }
      .ar-main {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .ar-area {
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .ar-goal {
        font-size: 13px;
        color: var(--text);
      }
      .ar-meta {
        display: flex;
        align-items: center;
        gap: var(--s-4);
        font-size: 10px;
        letter-spacing: 0.12em;
        color: var(--text-2);
      }
      .ar-score {
        font-size: 18px;
        letter-spacing: -0.03em;
      }
      .foot-actions {
        margin-top: var(--s-5);
        display: flex;
        justify-content: flex-end;
      }
      @media (max-width: 560px) {
        .wrow {
          grid-template-columns: 1fr auto;
        }
        .wrow ui-weight-bar {
          display: none;
        }
      }
    `,
  ],
})
export class MonthDetailComponent {
  private views = inject(ViewsService);
  private analytics = inject(AnalyticsService);
  private goalsSvc = inject(GoalService);
  private bus = inject(StateBus);
  private router = inject(Router);

  readonly year = input.required<string>();
  readonly month = input.required<string>();

  readonly editing = signal(false);
  readonly rows = signal<WeightRow[]>([]);

  private readonly mk = computed(() => {
    const y = Number(this.year());
    const m = Number(this.month());
    const cur = currentMonth();
    return Number.isFinite(y) && Number.isFinite(m) ? { year: y, month: m } : cur;
  });

  readonly monthLabel = computed(() => MONTH_NAMES[this.mk().month - 1]?.toUpperCase() ?? '—');

  readonly nodes = computed(() => {
    this.bus.revision();
    return this.views.goalNodes(this.mk());
  });

  readonly monthScore = computed(() => {
    this.bus.revision();
    return this.analytics.monthMeanScore(this.mk());
  });

  readonly weightTotal = computed(() =>
    this.nodes().reduce((sum, n) => sum + (n.goal.weight || 0), 0),
  );
  readonly weightTotalValid = computed(() => this.weightTotal() === 100);

  readonly editTotal = computed(() =>
    this.rows().reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
  );
  readonly editTotalValid = computed(() => this.editTotal() === 100 && this.rows().length > 0);

  startEdit(): void {
    this.rows.set(
      this.nodes().map((n) => ({
        id: n.goal.id,
        name: n.goal.title,
        area: n.area.name,
        weight: n.goal.weight || 0,
      })),
    );
    this.editing.set(true);
  }

  save(): void {
    if (!this.editTotalValid()) return;
    this.goalsSvc.setGoalWeights(
      this.mk(),
      this.rows().map((r) => ({ id: r.id, weight: Number(r.weight) || 0 })),
    );
    this.editing.set(false);
  }

  goalLink(n: GoalNode): unknown[] {
    return ['/app/months', this.mk().year, this.mk().month, 'goal', n.goal.id];
  }

  open(n: GoalNode): void {
    void this.router.navigate(this.goalLink(n));
  }
}
