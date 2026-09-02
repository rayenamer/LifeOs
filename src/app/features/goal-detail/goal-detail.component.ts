import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProcessSpec } from '../../core/services/goal.service';
import { GoalService } from '../../core/services/goal.service';
import { ExecutionService } from '../../core/services/execution.service';
import { StateBus } from '../../core/services/state-bus.service';
import { ViewsService } from '../../core/services/views.service';
import { today } from '../../core/util/date';
import { ProcessRowComponent } from '../../shared/components/process-row.component';
import { ScoreDialComponent } from '../../shared/components/score-dial.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

interface EditRow extends ProcessSpec {
  _key: string;
}

@Component({
  selector: 'app-goal-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ProcessRowComponent,
    ScoreDialComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!view()) {
      <ui-empty-state title="GOAL NOT FOUND." message="This goal may have been deleted." actionLabel="BACK TO MONTHS" actionLink="/app/months" />
    } @else {
      <header class="page-head">
        <a [routerLink]="['/app/months', view()!.goal.year, view()!.goal.month]" class="back mono">
          ← {{ view()!.area.name.toUpperCase() }}
        </a>
        <div class="hero">
          <div class="hero-text">
            <span class="eyebrow">MONTHLY GOAL · {{ view()!.goal.month }}/{{ view()!.goal.year }}</span>
            <h1>{{ view()!.goal.title }}</h1>
            @if (view()!.goal.description) { <p class="desc">{{ view()!.goal.description }}</p> }
          </div>
          <ui-score-dial [score]="view()!.monthScore" [size]="150" label="Month" />
        </div>
      </header>

      <div class="toolbar">
        <div class="toolbar-info mono">
          <span class="weight-state" [class.bad]="!weightsValid()">
            PROCESS WEIGHTS {{ weightTotal() }} / 100
          </span>
          <span class="month-weight">
            MONTH SHARE
            @if (!editing()) {
              {{ view()!.goal.weight }} / 100
            } @else {
              <input class="input mw-input" type="number" min="0" max="100" [(ngModel)]="goalWeight" />
            }
          </span>
        </div>
        @if (!editing()) {
          <button class="btn btn--ghost" type="button" (click)="startEdit()">EDIT GOAL</button>
        } @else {
          <div class="edit-actions">
            <button class="btn btn--ghost" type="button" (click)="editing.set(false)">CANCEL</button>
            <button class="btn btn--primary" type="button" [disabled]="!editWeightsValid()" (click)="save()">
              SAVE
            </button>
          </div>
        }
      </div>

      @if (!editing()) {
        <div class="panel proc-list">
          @if (!view()!.rows.length) {
            <p class="none mono">NO PROCESSES DEFINED.</p>
          }
          @for (row of view()!.rows; track row.process.id) {
            <ui-process-row [row]="row" (toggle)="toggle(row.process.id)" (setValue)="setValue(row.process.id, $event)" />
          }
        </div>
        <p class="note mono">
          DATA, NOT JUDGMENT — these numbers describe your process, not your worth.
        </p>
      } @else {
        <div class="panel editor">
          @for (r of rows(); track r._key; let i = $index) {
            <div class="erow">
              <input class="input e-name" [(ngModel)]="r.name" placeholder="Process name" />
              <input class="input e-desc" [(ngModel)]="r.description" placeholder="Description" />
              <label class="e-num">
                <span class="mono">WT</span>
                <input class="input" type="number" min="0" max="100" [(ngModel)]="r.weight" />
              </label>
              <label class="e-num">
                <span class="mono">TGT</span>
                <input class="input" type="number" min="1" [(ngModel)]="r.targetValue" />
              </label>
              <input class="input e-unit" [(ngModel)]="r.unit" placeholder="unit" />
              <button class="btn btn--danger remove" type="button" (click)="removeRow(i)" aria-label="Remove process">✕</button>
            </div>
          }
          <button class="btn add" type="button" (click)="addRow()">+ ADD PROCESS</button>
          <p class="e-hint mono" [class.bad]="!editWeightsValid()">
            TOTAL {{ editTotal() }} / 100 — {{ editWeightsValid() ? 'OK' : 'MUST EQUAL 100 TO SAVE' }}
          </p>
        </div>
      }
    }
  `,
  styles: [
    `
      .page-head {
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
        margin-bottom: var(--s-5);
      }
      .back {
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .back:hover { color: var(--accent); }
      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-5);
        flex-wrap: wrap;
      }
      h1 { font-size: clamp(20px, 3.4vw, 28px); max-width: 30ch; }
      .desc { color: var(--text-1); font-size: 13px; margin-top: var(--s-2); max-width: 52ch; line-height: 1.7; }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        margin-bottom: var(--s-3);
        flex-wrap: wrap;
      }
      .toolbar-info {
        display: flex;
        gap: var(--s-4);
        flex-wrap: wrap;
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .weight-state.bad { color: var(--danger); }
      .month-weight {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-1);
      }
      .mw-input { width: 60px; text-align: right; padding: 4px 6px; }
      .edit-actions { display: flex; gap: var(--s-2); }
      .proc-list { padding: 0 var(--s-5); }
      .none, .note { color: var(--text-3); font-size: 10px; letter-spacing: 0.14em; padding: var(--s-4) 0; }
      .note { margin-top: var(--s-4); }
      .editor { padding: var(--s-5); display: flex; flex-direction: column; gap: var(--s-3); }
      .erow {
        display: grid;
        grid-template-columns: 1.3fr 1.6fr auto auto 0.7fr auto;
        gap: var(--s-2);
        align-items: center;
      }
      .e-num { display: flex; align-items: center; gap: 4px; }
      .e-num span { font-size: 9px; color: var(--text-3); }
      .e-num .input { width: 62px; text-align: right; }
      .remove { padding: 8px 10px; }
      .add { align-self: flex-start; }
      .e-hint { font-size: 10px; letter-spacing: 0.14em; color: var(--text-2); }
      .e-hint.bad { color: var(--danger); }
      @media (max-width: 720px) {
        .erow { grid-template-columns: 1fr 1fr; }
        .erow .e-name, .erow .e-desc { grid-column: 1 / -1; }
      }
    `,
  ],
})
export class GoalDetailComponent {
  private views = inject(ViewsService);
  private goals = inject(GoalService);
  private execution = inject(ExecutionService);
  private bus = inject(StateBus);

  readonly goalId = input.required<string>();
  readonly editing = signal(false);
  readonly rows = signal<EditRow[]>([]);
  readonly goalWeight = signal(0);

  readonly view = computed(() => {
    this.bus.revision();
    return this.views.goalDetail(this.goalId());
  });

  readonly weightTotal = computed(() => this.view()?.weightTotal ?? 0);
  readonly weightsValid = computed(() => this.weightTotal() === 100);

  readonly editTotal = computed(() =>
    this.rows().reduce((s, r) => s + (Number(r.weight) || 0), 0),
  );
  readonly editWeightsValid = computed(() => this.editTotal() === 100 && this.rows().length > 0);

  startEdit(): void {
    const v = this.view();
    if (!v) return;
    this.rows.set(
      v.rows.map((r, i) => ({
        _key: `${r.process.id}-${i}`,
        id: r.process.id,
        name: r.process.name,
        description: r.process.description,
        weight: r.process.weight,
        targetValue: r.process.targetValue,
        unit: r.process.unit,
      })),
    );
    this.goalWeight.set(v.goal.weight);
    this.editing.set(true);
  }

  addRow(): void {
    this.rows.update((rs) => [
      ...rs,
      { _key: `new-${Date.now()}-${rs.length}`, name: '', description: '', weight: 0, targetValue: 1, unit: '' },
    ]);
  }

  removeRow(i: number): void {
    this.rows.update((rs) => rs.filter((_, idx) => idx !== i));
  }

  save(): void {
    if (!this.editWeightsValid()) return;
    const specs: ProcessSpec[] = this.rows().map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      weight: Number(r.weight) || 0,
      targetValue: Number(r.targetValue) || 1,
      unit: r.unit,
    }));
    this.goals.replaceProcesses(this.goalId(), specs);
    const w = Math.max(0, Math.round(Number(this.goalWeight()) || 0));
    if (w !== this.view()?.goal.weight) {
      this.goals.updateGoal(this.goalId(), { weight: w });
    }
    this.editing.set(false);
  }

  toggle(processId: string): void {
    this.execution.toggleProcess(processId, today());
  }

  setValue(processId: string, value: number): void {
    this.execution.setActualValue(processId, today(), value);
  }
}
