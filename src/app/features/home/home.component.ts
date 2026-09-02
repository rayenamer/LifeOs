import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MonthSummary } from '../../core/models';
import { AnalyticsService } from '../../core/services/analytics.service';
import { StateBus } from '../../core/services/state-bus.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ScoreColorPipe } from '../../shared/pipes/pipes';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, ScoreColorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <span class="eyebrow">TIMELINE</span>
      <h1>Months</h1>
      <p class="lede">
        Each month holds a set of goals. The score is the mean daily execution across elapsed days —
        information about the process, nothing more.
      </p>
    </header>

    @if (isEmpty()) {
      <ui-empty-state
        eyebrow="YOUR SYSTEM IS EMPTY."
        title="NO MONTHS ON RECORD."
        message="Create your first monthly goal to begin translating direction into daily process."
        actionLabel="START A GOAL"
        actionLink="/app/goals/new"
      />
    } @else {
      @for (group of timeline(); track group.year) {
        <section class="year">
          <div class="year-label mono">{{ group.year }}</div>
          <div class="months">
            @for (m of group.months; track m.month) {
              <a
                class="month"
                [class.current]="m.isCurrent"
                [class.future]="m.isFuture"
                [class.empty]="!m.activeGoals"
                [routerLink]="['/app/months', m.year, m.month]"
              >
                <div class="m-top">
                  <span class="m-name mono">{{ m.label }}</span>
                  @if (m.isCurrent) { <span class="tag mono">NOW</span> }
                </div>
                <div class="m-score mono" [style.color]="m.hasData ? (m.score | scoreColor) : 'var(--text-3)'">
                  {{ m.hasData ? m.score : '—' }}
                </div>
                <div class="m-meta mono">
                  <span>{{ m.activeGoals }} {{ m.activeGoals === 1 ? 'GOAL' : 'GOALS' }}</span>
                  @if (!m.isFuture) {
                    <span>{{ pct(m.consistency) }}% CONSISTENT</span>
                  }
                </div>
                <div class="spark">
                  <div class="spark-fill" [style.width.%]="m.hasData ? m.score : 0"
                       [style.background]="m.score | scoreColor"></div>
                </div>
              </a>
            }
          </div>
        </section>
      }
    }
  `,
  styles: [
    `
      .page-head {
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
        margin-bottom: var(--s-7);
      }
      h1 {
        font-size: clamp(24px, 4vw, 32px);
      }
      .lede {
        color: var(--text-1);
        font-size: 13px;
        line-height: 1.7;
        max-width: 60ch;
      }
      .year {
        margin-bottom: var(--s-7);
      }
      .year-label {
        font-size: 11px;
        letter-spacing: 0.24em;
        color: var(--text-2);
        padding-bottom: var(--s-3);
        border-bottom: 1px solid var(--border);
        margin-bottom: var(--s-4);
      }
      .months {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--s-3);
      }
      .month {
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
        padding: var(--s-4);
        border: 1px solid var(--border);
        border-radius: var(--r-3);
        background: var(--bg-1);
        transition: border-color var(--dur-1) var(--ease), transform var(--dur-1) var(--ease);
      }
      .month:hover {
        border-color: var(--border-strong);
        transform: translateY(-2px);
      }
      .month.current {
        border-color: var(--accent);
        background: var(--accent-dim);
      }
      .month.future {
        opacity: 0.5;
      }
      .m-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .m-name {
        font-size: 12px;
        letter-spacing: 0.14em;
        color: var(--text-1);
      }
      .tag {
        font-size: 9px;
        letter-spacing: 0.18em;
        color: var(--accent);
        border: 1px solid var(--accent);
        border-radius: var(--r-1);
        padding: 1px 5px;
      }
      .m-score {
        font-size: 40px;
        font-weight: 500;
        letter-spacing: -0.04em;
        line-height: 1;
      }
      .m-meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--text-2);
      }
      .spark {
        height: 3px;
        background: var(--bg-3);
        border-radius: 2px;
        overflow: hidden;
      }
      .spark-fill {
        height: 100%;
        transition: width var(--dur-3) var(--ease);
      }
    `,
  ],
})
export class HomeComponent {
  private analytics = inject(AnalyticsService);
  private bus = inject(StateBus);

  readonly timeline = computed(() => {
    this.bus.revision();
    return this.analytics.monthTimeline();
  });

  readonly isEmpty = computed(() =>
    this.timeline().every((g) => g.months.every((m: MonthSummary) => m.activeGoals === 0)),
  );

  pct(v: number): number {
    return Math.round(v * 100);
  }
}
