import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LifeArea, MonthKey } from '../../core/models';
import { GoalService, ProcessSpec } from '../../core/services/goal.service';
import { StateBus } from '../../core/services/state-bus.service';
import { MONTH_NAMES, currentMonth } from '../../core/util/date';
import { WeightBarComponent } from '../../shared/components/weight-bar.component';

interface PSpec extends ProcessSpec {
  key: string;
}

const STEPS = ['LIFE AREA', 'MONTH', 'THE GOAL', 'PROCESSES', 'WEIGHTS', 'CONFIRM'];

@Component({
  selector: 'app-goal-wizard',
  standalone: true,
  imports: [FormsModule, RouterLink, WeightBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <a routerLink="/app/months" class="back mono">← CANCEL</a>
      <span class="eyebrow">NEW MONTHLY GOAL</span>
      <h1>{{ STEPS[step()] }}</h1>
      <ol class="steps mono">
        @for (s of STEPS; track s; let i = $index) {
          <li [class.on]="i === step()" [class.done]="i < step()">{{ i + 1 }}</li>
        }
      </ol>
    </header>

    <section class="panel body">
      @switch (step()) {
        @case (0) {
          <p class="q">Which life area does this goal belong to?</p>
          <div class="area-grid">
            @for (a of areas(); track a.id) {
              <button
                class="pick"
                type="button"
                [class.sel]="areaId() === a.id"
                (click)="areaId.set(a.id); newArea.set(false)"
              >
                <span class="pick-name mono">{{ a.name.toUpperCase() }}</span>
                @if (a.description) { <span class="pick-desc">{{ a.description }}</span> }
              </button>
            }
            <button class="pick new" type="button" [class.sel]="newArea()" (click)="newArea.set(true); areaId.set('')">
              <span class="pick-name mono">+ NEW LIFE AREA</span>
            </button>
          </div>
          @if (newArea()) {
            <div class="new-area-form">
              <div class="field"><label>NAME</label><input class="input" [(ngModel)]="newAreaName" placeholder="e.g. Relationships" /></div>
              <div class="field"><label>DESCRIPTION</label><input class="input" [(ngModel)]="newAreaDesc" placeholder="Optional" /></div>
            </div>
          }
        }

        @case (1) {
          <p class="q">Which month are you planning?</p>
          <div class="month-grid">
            @for (m of monthOptions(); track m.year + '-' + m.month) {
              <button
                class="pick"
                type="button"
                [class.sel]="month().year === m.year && month().month === m.month"
                (click)="pickMonth(m)"
              >
                <span class="pick-name mono">{{ label(m) }}</span>
                <span class="pick-desc">{{ existingMonthTotal(m) }} / 100 allocated</span>
              </button>
            }
          </div>
        }

        @case (2) {
          <p class="q">Name the goal. This is the direction — an outcome you can influence but not fully control.</p>
          <div class="field"><label>GOAL TITLE</label><input class="input" [(ngModel)]="title" placeholder="e.g. Build momentum toward a new role" /></div>
          <div class="field"><label>WHY IT MATTERS (OPTIONAL)</label><textarea class="textarea" [(ngModel)]="description" placeholder="The context you'll want when you review this later."></textarea></div>
          <div class="field">
            <label>MONTH WEIGHT — THIS GOAL'S SHARE OF {{ label(month()) }}</label>
            <div class="goal-weight-row">
              <input class="input" type="number" min="0" [max]="100 - monthTotal()" [(ngModel)]="goalWeight" />
              <span class="gw-hint mono" [class.bad]="goalWeightInvalid()">
                {{ monthTotal() }} ALREADY ALLOCATED · {{ 100 - monthTotal() }} LEFT
              </span>
            </div>
            <p class="gw-note">Goals in a month sum to 100 — like processes within a goal. You can rebalance any time from the month view.</p>
          </div>
        }

        @case (3) {
          <p class="q">Define the daily processes — the controllable behaviours that move this goal. Weights must total 100.</p>
          @for (p of specs(); track p.key; let i = $index) {
            <div class="prow">
              <input class="input p-name" [(ngModel)]="p.name" placeholder="Process name" />
              <input class="input p-desc" [(ngModel)]="p.description" placeholder="Description (optional)" />
              <label class="p-num"><span class="mono">WT</span><input class="input" type="number" min="0" max="100" [(ngModel)]="p.weight" /></label>
              <label class="p-num"><span class="mono">TGT</span><input class="input" type="number" min="1" [(ngModel)]="p.targetValue" /></label>
              <input class="input p-unit" [(ngModel)]="p.unit" placeholder="unit" />
              <button class="btn btn--danger rm" type="button" (click)="removeSpec(i)" aria-label="Remove">✕</button>
            </div>
          }
          <button class="btn add" type="button" (click)="addSpec()">+ ADD PROCESS</button>
          <p class="total mono" [class.bad]="!weightsValid()">TOTAL {{ total() }} / 100</p>
        }

        @case (4) {
          <p class="q">Weight review. Each bar is one process's share of the goal.</p>
          <div class="weights">
            @for (p of specs(); track p.key) {
              <div class="wline">
                <span class="w-name">{{ p.name || 'Untitled process' }}</span>
                <ui-weight-bar [weight]="+p.weight" [ratio]="1" />
                <span class="w-num mono">{{ p.weight }}</span>
              </div>
            }
          </div>
          <p class="total big mono" [class.bad]="!weightsValid()">
            {{ total() }} / 100 — {{ weightsValid() ? 'BALANCED' : 'ADJUST TO EXACTLY 100' }}
          </p>
        }

        @case (5) {
          <p class="q">Confirm and create.</p>
          <dl class="confirm mono">
            <div><dt>LIFE AREA</dt><dd>{{ areaName() }}</dd></div>
            <div><dt>MONTH</dt><dd>{{ label(month()) }}</dd></div>
            <div><dt>GOAL</dt><dd>{{ title() || '—' }}</dd></div>
            <div><dt>MONTH WEIGHT</dt><dd>{{ goalWeight() }} / 100</dd></div>
            <div><dt>PROCESSES</dt><dd>{{ validSpecs().length }}</dd></div>
            <div><dt>PROCESS WEIGHTS</dt><dd>{{ total() }} / 100</dd></div>
          </dl>
          @if (error()) { <p class="err mono">{{ error() }}</p> }
        }
      }
    </section>

    <div class="nav-actions">
      <button class="btn btn--ghost" type="button" [disabled]="step() === 0" (click)="prev()">BACK</button>
      @if (step() < 5) {
        <button class="btn btn--primary" type="button" [disabled]="!canNext()" (click)="next()">NEXT</button>
      } @else {
        <button class="btn btn--primary" type="button" [disabled]="!canCreate()" (click)="create()">CREATE GOAL</button>
      }
    </div>
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-5); }
      .back { font-size: 10px; letter-spacing: 0.16em; color: var(--text-2); }
      .back:hover { color: var(--accent); }
      h1 { font-size: clamp(20px, 3.6vw, 28px); }
      .steps { display: flex; gap: var(--s-2); list-style: none; }
      .steps li {
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        border: 1px solid var(--border-1);
        border-radius: 50%;
        font-size: 10px;
        color: var(--text-3);
      }
      .steps li.on { border-color: var(--accent); color: var(--accent); }
      .steps li.done { border-color: var(--score-high); color: var(--score-high); }
      .body { padding: var(--s-6); display: flex; flex-direction: column; gap: var(--s-4); min-height: 280px; }
      .q { font-size: 14px; color: var(--text-1); line-height: 1.7; max-width: 60ch; }
      .area-grid, .month-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-3);
      }
      .pick {
        text-align: left;
        padding: var(--s-4);
        border: 1px solid var(--border);
        border-radius: var(--r-2);
        background: var(--bg);
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        transition: border-color var(--dur-1) var(--ease);
      }
      .pick:hover { border-color: var(--border-strong); }
      .pick.sel { border-color: var(--accent); background: var(--accent-dim); }
      .pick-name { font-size: 11px; letter-spacing: 0.12em; color: var(--text); }
      .pick-desc { font-size: 11px; color: var(--text-2); }
      .new-area-form { display: flex; gap: var(--s-3); flex-wrap: wrap; }
      .new-area-form .field { flex: 1; min-width: 180px; }
      .prow {
        display: grid;
        grid-template-columns: 1.2fr 1.5fr auto auto 0.7fr auto;
        gap: var(--s-2);
        align-items: center;
      }
      .p-num { display: flex; align-items: center; gap: 4px; }
      .p-num span { font-size: 9px; color: var(--text-3); }
      .p-num .input { width: 60px; text-align: right; }
      .rm { padding: 8px 10px; }
      .add { align-self: flex-start; }
      .total { font-size: 11px; letter-spacing: 0.14em; color: var(--text-2); }
      .total.bad { color: var(--danger); }
      .goal-weight-row { display: flex; align-items: center; gap: var(--s-3); }
      .goal-weight-row .input { width: 90px; text-align: right; }
      .gw-hint { font-size: 10px; letter-spacing: 0.12em; color: var(--text-2); }
      .gw-hint.bad { color: var(--danger); }
      .gw-note { font-size: 11px; color: var(--text-3); line-height: 1.6; }
      .total.big { font-size: 14px; }
      .weights { display: flex; flex-direction: column; gap: var(--s-3); }
      .wline { display: grid; grid-template-columns: 1fr 2fr auto; gap: var(--s-3); align-items: center; }
      .w-name { font-size: 12px; color: var(--text-1); }
      .w-num { font-size: 12px; color: var(--text); }
      .confirm { display: flex; flex-direction: column; gap: var(--s-3); }
      .confirm div { display: flex; justify-content: space-between; gap: var(--s-4); border-bottom: 1px solid var(--border); padding-bottom: var(--s-2); }
      .confirm dt { font-size: 10px; letter-spacing: 0.14em; color: var(--text-3); }
      .confirm dd { font-size: 13px; color: var(--text); text-align: right; }
      .err { color: var(--danger); font-size: 11px; }
      .nav-actions { display: flex; justify-content: space-between; margin-top: var(--s-4); }
      @media (max-width: 720px) {
        .prow { grid-template-columns: 1fr 1fr; }
        .prow .p-name, .prow .p-desc { grid-column: 1 / -1; }
      }
    `,
  ],
})
export class GoalWizardComponent {
  private goals = inject(GoalService);
  private bus = inject(StateBus);
  private router = inject(Router);

  readonly STEPS = STEPS;
  readonly step = signal(0);
  readonly error = signal('');

  readonly areas = computed<LifeArea[]>(() => {
    this.bus.revision();
    return this.goals.areasList();
  });

  readonly areaId = signal('');
  readonly newArea = signal(false);
  readonly newAreaName = signal('');
  readonly newAreaDesc = signal('');

  readonly month = signal<MonthKey>(currentMonth());
  readonly title = signal('');
  readonly description = signal('');
  readonly goalWeight = signal(0);

  readonly monthTotal = computed(() => {
    this.bus.revision();
    return this.goals.monthWeightTotal(this.month());
  });
  readonly goalWeightInvalid = computed(
    () => this.monthTotal() + (Number(this.goalWeight()) || 0) > 100,
  );

  readonly specs = signal<PSpec[]>([
    { key: 's0', name: '', description: '', weight: 50, targetValue: 1, unit: '' },
    { key: 's1', name: '', description: '', weight: 50, targetValue: 1, unit: '' },
  ]);

  readonly total = computed(() => this.specs().reduce((s, p) => s + (Number(p.weight) || 0), 0));
  readonly validSpecs = computed(() => this.specs().filter((p) => p.name.trim().length > 0));
  readonly weightsValid = computed(() => this.total() === 100 && this.validSpecs().length > 0);

  readonly areaName = computed(() => {
    if (this.newArea()) return this.newAreaName().trim() || '(new area)';
    return this.areas().find((a) => a.id === this.areaId())?.name ?? '—';
  });

  monthOptions(): MonthKey[] {
    const cur = currentMonth();
    const out: MonthKey[] = [];
    for (let d = -1; d <= 3; d++) {
      const total = cur.year * 12 + (cur.month - 1) + d;
      out.push({ year: Math.floor(total / 12), month: (total % 12) + 1 });
    }
    return out;
  }

  label(m: MonthKey): string {
    return `${MONTH_NAMES[m.month - 1].toUpperCase()} ${m.year}`;
  }

  existingMonthTotal(m: MonthKey): number {
    this.bus.revision();
    return this.goals.monthWeightTotal(m);
  }

  pickMonth(m: MonthKey): void {
    this.month.set(m);
    // suggest the remaining capacity so the month lands on 100
    this.goalWeight.set(Math.max(0, 100 - this.goals.monthWeightTotal(m)));
  }

  canNext(): boolean {
    switch (this.step()) {
      case 0:
        return this.newArea() ? this.newAreaName().trim().length > 0 : this.areaId().length > 0;
      case 2:
        return (
          this.title().trim().length > 0 &&
          (Number(this.goalWeight()) || 0) > 0 &&
          !this.goalWeightInvalid()
        );
      case 3:
        return this.weightsValid();
      case 4:
        return this.weightsValid();
      default:
        return true;
    }
  }

  canCreate(): boolean {
    return (
      this.weightsValid() &&
      this.title().trim().length > 0 &&
      (Number(this.goalWeight()) || 0) > 0 &&
      !this.goalWeightInvalid()
    );
  }

  addSpec(): void {
    this.specs.update((s) => [
      ...s,
      { key: `s${Date.now()}`, name: '', description: '', weight: 0, targetValue: 1, unit: '' },
    ]);
  }

  removeSpec(i: number): void {
    this.specs.update((s) => s.filter((_, idx) => idx !== i));
  }

  next(): void {
    if (this.canNext()) this.step.update((s) => Math.min(5, s + 1));
  }

  prev(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  create(): void {
    this.error.set('');
    try {
      let areaId = this.areaId();
      if (this.newArea()) {
        areaId = this.goals.createArea(this.newAreaName().trim(), this.newAreaDesc().trim()).id;
      }
      const goal = this.goals.createGoal({
        lifeAreaId: areaId,
        month: this.month(),
        title: this.title().trim(),
        description: this.description().trim(),
        weight: Number(this.goalWeight()) || 0,
        processes: this.validSpecs().map((p) => ({
          name: p.name,
          description: p.description,
          weight: Number(p.weight) || 0,
          targetValue: Number(p.targetValue) || 1,
          unit: p.unit,
        })),
      });
      void this.router.navigate(['/app/months', goal.year, goal.month, 'goal', goal.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not create the goal.');
    }
  }
}
