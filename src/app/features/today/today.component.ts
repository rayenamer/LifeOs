import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExecutionService } from '../../core/services/execution.service';
import { StateBus } from '../../core/services/state-bus.service';
import { ViewsService } from '../../core/services/views.service';
import { MONTH_NAMES, WEEKDAY_NAMES, ordinal, parseIso, today } from '../../core/util/date';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProcessRowComponent } from '../../shared/components/process-row.component';
import { ScoreDialComponent } from '../../shared/components/score-dial.component';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [RouterLink, ProcessRowComponent, ScoreDialComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <span class="eyebrow">{{ weekday() }} · {{ dateLabel() }}</span>
        <h1>Today</h1>
        <p class="lede">Execute the process. The score updates as you go — it's feedback, not a verdict.</p>
      </div>
      <div class="score">
        <ui-score-dial [score]="view().score" [size]="164" label="Day score" />
        <div class="badges mono">
          @if (view().isFreezeDay) {
            <span class="badge freeze">FREEZE DAY</span>
          } @else if (view().isMinimumViableDay) {
            <span class="badge ok">VIABLE DAY · ≥ {{ view().minimumViableDay }}</span>
          } @else {
            <span class="badge">MIN VIABLE DAY {{ view().minimumViableDay }}</span>
          }
        </div>
      </div>
    </header>

    @if (!view().hasGoals) {
      <ui-empty-state
        eyebrow="NOTHING TO EXECUTE"
        title="NO PROCESSES FOR THIS MONTH."
        message="Create a goal with daily processes and they'll appear here every day."
        actionLabel="CREATE A GOAL"
        actionLink="/app/goals/new"
      />
    } @else {
      @for (group of view().groups; track group.goal.id) {
        @if (group.rows.length) {
          <section class="area panel">
            <div class="area-head">
              <div>
                <span class="area-name mono">{{ group.area.name.toUpperCase() }}</span>
                <span class="goal-title">{{ group.goal.title }}</span>
              </div>
              <a class="area-score mono" [routerLink]="['/app/months', group.goal.year, group.goal.month, 'goal', group.goal.id]">
                {{ group.areaScore }}
              </a>
            </div>
            @for (row of group.rows; track row.process.id) {
              <ui-process-row
                [row]="row"
                (toggle)="toggle(row.process.id)"
                (setValue)="setValue(row.process.id, $event)"
              />
            }
          </section>
        }
      }
      <p class="reassurance mono">CONSISTENCY &gt; PERFECTION — a partial day still counts.</p>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-5);
        margin-bottom: var(--s-6);
        flex-wrap: wrap;
      }
      h1 { font-size: clamp(24px, 4vw, 32px); }
      .lede { color: var(--text-1); font-size: 13px; margin-top: var(--s-2); max-width: 46ch; line-height: 1.7; }
      .score {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-3);
      }
      .badges { display: flex; gap: var(--s-2); flex-wrap: wrap; justify-content: center; }
      .badge {
        font-size: 9px;
        letter-spacing: 0.14em;
        padding: 3px 8px;
        border: 1px solid var(--border-1);
        border-radius: var(--r-1);
        color: var(--text-2);
      }
      .badge.ok { color: var(--score-high); border-color: var(--score-high); }
      .badge.freeze { color: var(--freeze); border-color: var(--freeze); }
      .area { padding: var(--s-4) var(--s-5); margin-bottom: var(--s-4); }
      .area-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding-bottom: var(--s-3);
        border-bottom: 1px solid var(--border);
      }
      .area-name {
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--text-2);
        display: block;
        margin-bottom: 2px;
      }
      .goal-title { font-size: 13px; color: var(--text); }
      .area-score {
        font-size: 20px;
        letter-spacing: -0.03em;
        color: var(--text-1);
      }
      .area-score:hover { color: var(--accent); }
      .reassurance {
        margin-top: var(--s-5);
        font-size: 10px;
        letter-spacing: 0.14em;
        color: var(--text-3);
        text-align: center;
      }
      @media (max-width: 620px) {
        .head { flex-direction: column; align-items: stretch; }
        .score { align-items: flex-start; }
      }
    `,
  ],
})
export class TodayComponent {
  private views = inject(ViewsService);
  private execution = inject(ExecutionService);
  private bus = inject(StateBus);

  private readonly date = today();

  readonly view = computed(() => {
    this.bus.revision();
    return this.views.todayView(this.date);
  });

  readonly weekday = computed(() => WEEKDAY_NAMES[parseIso(this.date).getDay()].toUpperCase());
  readonly dateLabel = computed(() => {
    const d = parseIso(this.date);
    return `${MONTH_NAMES[d.getMonth()].toUpperCase()} ${ordinal(d.getDate()).toUpperCase()}`;
  });

  toggle(processId: string): void {
    this.execution.toggleProcess(processId, this.date);
  }

  setValue(processId: string, value: number): void {
    this.execution.setActualValue(processId, this.date, value);
  }
}
