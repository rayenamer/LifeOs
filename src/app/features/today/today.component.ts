import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GoalNode } from '../../core/models';
import { ExecutionService } from '../../core/services/execution.service';
import { StateBus } from '../../core/services/state-bus.service';
import { ViewsService } from '../../core/services/views.service';
import { MONTH_NAMES, WEEKDAY_NAMES, ordinal, parseIso, today } from '../../core/util/date';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProcessRowComponent } from '../../shared/components/process-row.component';
import { RadialConstellationComponent } from '../../shared/components/radial-constellation.component';
import { ScoreDialComponent } from '../../shared/components/score-dial.component';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [
    RouterLink,
    ProcessRowComponent,
    ScoreDialComponent,
    RadialConstellationComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <span class="eyebrow">{{ weekday() }} · {{ dateLabel() }}</span>
        <h1>Today</h1>
        <p class="lede">Execute the process. The score updates as you go — it's feedback, not a verdict.</p>
      </div>
      <div class="score">
        <ui-score-dial [score]="view().score" [size]="132" label="Day score" />
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
      <div class="layout">
        <aside class="overview panel">
          <span class="ov-title mono">TODAY · ADVANCEMENT</span>
          <ui-radial-constellation
            [nodes]="nodes()"
            centerLabel="TODAY"
            [centerScore]="view().score"
            (pick)="openGoal($event)"
          />
          <p class="ov-hint mono">RING = TODAY'S SCORE · INNER DOT = PROCESSES DONE</p>
        </aside>

        <div class="areas-wrap">
          <span class="areas-cap mono">GOALS · BIGGEST SHARE OF THE MONTH FIRST — START HERE</span>
          <div class="areas">
          @for (group of view().groups; track group.goal.id) {
            @if (group.rows.length) {
              <section class="area panel">
                <div class="area-head">
                  <div class="area-id">
                    <span class="area-name mono">{{ group.area.name.toUpperCase() }}</span>
                    <span class="goal-title">{{ group.goal.title }}</span>
                  </div>
                  <a
                    class="area-score mono"
                    [class.zero]="group.areaScore === 0"
                    [routerLink]="['/app/months', group.goal.year, group.goal.month, 'goal', group.goal.id]"
                  >
                    <span class="as-share">SHARE {{ group.goal.weight }}</span>
                    <span class="as-num">{{ group.areaScore }}</span>
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
          </div>
        </div>
      </div>
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
        margin-bottom: var(--s-5);
        flex-wrap: wrap;
      }
      h1 { font-size: clamp(24px, 4vw, 32px); }
      .lede { color: var(--text-1); font-size: 13px; margin-top: var(--s-2); max-width: 46ch; line-height: 1.7; }
      .score { display: flex; flex-direction: column; align-items: center; gap: var(--s-3); }
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

      .layout {
        display: grid;
        grid-template-columns: minmax(320px, 380px) 1fr;
        gap: var(--s-5);
        align-items: start;
      }
      .overview {
        position: sticky;
        top: var(--s-4);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
        padding: var(--s-5) var(--s-5) var(--s-4);
      }
      .ov-title {
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--text-2);
      }
      .ov-hint {
        font-size: 9px;
        letter-spacing: 0.1em;
        color: var(--text-3);
        text-align: center;
      }

      .areas-wrap { display: flex; flex-direction: column; gap: var(--s-3); min-width: 0; }
      .areas-cap {
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .areas {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--s-4);
        align-content: start;
      }
      .area { padding: var(--s-4) var(--s-4) var(--s-2); min-width: 0; }
      .area-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-3);
        padding-bottom: var(--s-2);
        border-bottom: 1px solid var(--border);
      }
      .area-id { min-width: 0; }
      .area-name {
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--text-2);
        display: block;
        margin-bottom: 2px;
      }
      .goal-title {
        font-size: 13px;
        color: var(--text);
        display: block;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }
      .area-score {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1;
        color: var(--text-1);
        white-space: nowrap;
      }
      .area-score .as-share {
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--accent);
        margin-bottom: 4px;
      }
      .area-score .as-num { font-size: 20px; letter-spacing: -0.03em; }
      .area-score:hover .as-num { color: var(--accent); }
      .area-score.zero .as-num { color: var(--text-3); }

      .reassurance {
        margin-top: var(--s-5);
        font-size: 10px;
        letter-spacing: 0.14em;
        color: var(--text-3);
        text-align: center;
      }

      /* Break the Today screen out of the shell's centred content column so the
         goal grid gets real width on a large monitor. */
      @media (min-width: 1041px) {
        :host {
          --today-w: min(1680px, calc(100vw - var(--nav-w) - 2 * var(--s-6)));
          display: block;
          width: var(--today-w);
          margin-inline: calc((100% - var(--today-w)) / 2);
        }
      }
      @media (max-width: 1500px) {
        .areas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 1100px) {
        .layout { grid-template-columns: 1fr; }
        .overview { position: static; align-items: center; }
        .overview ui-radial-constellation { max-width: 440px; width: 100%; }
      }
      @media (max-width: 760px) {
        .areas { grid-template-columns: 1fr; }
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
  private router = inject(Router);

  private readonly date = today();

  readonly view = computed(() => {
    this.bus.revision();
    return this.views.todayView(this.date);
  });

  readonly nodes = computed(() => {
    this.bus.revision();
    return this.views.todayNodes(this.date);
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

  openGoal(node: GoalNode): void {
    void this.router.navigate([
      '/app/months',
      node.goal.year,
      node.goal.month,
      'goal',
      node.goal.id,
    ]);
  }
}
