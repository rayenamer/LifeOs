import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ConsistencyService } from '../../core/services/consistency.service';
import { StateBus } from '../../core/services/state-bus.service';
import { BarsChartComponent } from '../../shared/components/bars-chart.component';
import { CalendarHeatmapComponent } from '../../shared/components/calendar-heatmap.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StreakBadgeComponent } from '../../shared/components/streak-badge.component';
import { TrendChartComponent } from '../../shared/components/trend-chart.component';

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [
    TrendChartComponent,
    BarsChartComponent,
    CalendarHeatmapComponent,
    StreakBadgeComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <span class="eyebrow">ANALYSIS</span>
      <h1>Insights</h1>
      <p class="lede">Patterns across your execution. Read them as diagnostics for the system, not a scoreboard.</p>
    </header>

    @if (!hasData()) {
      <ui-empty-state
        eyebrow="NOT ENOUGH SIGNAL"
        title="NO HISTORY TO ANALYSE YET."
        message="Execute processes for a few days and the trends, heatmap and per-area breakdown will populate here."
        actionLabel="GO TO TODAY"
        actionLink="/app/today"
      />
    } @else {
      <div class="metrics">
        @for (m of metrics(); track m.label) {
          <div class="metric panel">
            <span class="m-val mono">{{ m.value }}</span>
            <span class="m-lbl mono">{{ m.label }}</span>
          </div>
        }
      </div>

      <div class="two">
        <section class="panel block">
          <h2 class="section-title">DAILY SCORE TREND</h2>
          <ui-trend-chart [points]="v().trend" />
        </section>
        <section class="panel block">
          <h2 class="section-title">CONSISTENCY</h2>
          <ui-streak-badge [streak]="streak()" />
          <dl class="mini-stats mono">
            <div><dt>ACTIVE DAYS</dt><dd>{{ v().activeDays }}</dd></div>
            <div><dt>MISSED DAYS</dt><dd>{{ v().missedDays }}</dd></div>
            <div><dt>FREEZE USED</dt><dd>{{ v().freezeDaysUsed }}</dd></div>
          </dl>
        </section>
      </div>

      <section class="panel block">
        <h2 class="section-title">CONSISTENCY CALENDAR</h2>
        <ui-calendar-heatmap [cells]="v().heatmap" />
      </section>

      <div class="two">
        <section class="panel block">
          <h2 class="section-title">SCORE BY LIFE AREA · THIS MONTH</h2>
          @if (v().scoreByArea.length) {
            <ui-bars-chart [scores]="v().scoreByArea" [height]="Math.max(140, v().scoreByArea.length * 44)" />
          } @else { <p class="none mono">NO GOALS THIS MONTH.</p> }
        </section>
        <section class="panel block">
          <h2 class="section-title">SCORE BY MONTH</h2>
          @if (v().scoreByMonth.length) {
            <ui-bars-chart [scores]="v().scoreByMonth" [horizontal]="false" [height]="220" />
          } @else { <p class="none mono">NO RECORDED MONTHS.</p> }
        </section>
      </div>

      <section class="panel block">
        <h2 class="section-title">PROCESS EXECUTION · THIS MONTH</h2>
        @if (v().scoreByProcess.length) {
          <ui-bars-chart [scores]="v().scoreByProcess" [height]="Math.max(160, v().scoreByProcess.length * 34)" />
          <div class="extremes mono">
            @if (v().strongestProcess) {
              <span class="good">STRONGEST · {{ v().strongestProcess!.label }} ({{ v().strongestProcess!.score }})</span>
            }
            @if (v().weakestProcess) {
              <span class="weak">WEAKEST · {{ v().weakestProcess!.label }} ({{ v().weakestProcess!.score }})</span>
            }
          </div>
        } @else { <p class="none mono">NO PROCESSES THIS MONTH.</p> }
      </section>
    }
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-6); }
      h1 { font-size: clamp(24px, 4vw, 32px); }
      .lede { color: var(--text-1); font-size: 13px; line-height: 1.7; max-width: 58ch; }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: var(--s-3);
        margin-bottom: var(--s-5);
      }
      .metric {
        padding: var(--s-4);
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
      }
      .m-val { font-size: 30px; font-weight: 500; letter-spacing: -0.04em; color: var(--text); line-height: 1; }
      .m-lbl { font-size: 9px; letter-spacing: 0.14em; color: var(--text-2); }
      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-4);
        margin-bottom: var(--s-4);
      }
      .block { padding: var(--s-5); margin-bottom: var(--s-4); }
      .block h2 { margin-bottom: var(--s-4); }
      .mini-stats {
        display: flex;
        gap: var(--s-5);
        margin-top: var(--s-4);
        font-size: 10px;
        letter-spacing: 0.12em;
      }
      .mini-stats dt { color: var(--text-3); }
      .mini-stats dd { color: var(--text); font-size: 18px; margin-top: 2px; }
      .none { color: var(--text-3); font-size: 10px; letter-spacing: 0.14em; padding: var(--s-4) 0; }
      .extremes { display: flex; flex-wrap: wrap; gap: var(--s-4); margin-top: var(--s-4); font-size: 10px; letter-spacing: 0.1em; }
      .extremes .good { color: var(--score-high); }
      .extremes .weak { color: var(--score-low); }
      @media (max-width: 900px) {
        .two { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class InsightsComponent {
  private analytics = inject(AnalyticsService);
  private consistency = inject(ConsistencyService);
  private bus = inject(StateBus);

  readonly Math = Math;

  readonly v = computed(() => {
    this.bus.revision();
    return this.analytics.insights();
  });

  readonly streak = this.consistency.streak;

  readonly hasData = computed(() => this.v().trend.length > 0);

  readonly metrics = computed(() => {
    const v = this.v();
    return [
      { label: 'AVG DAILY', value: v.avgDaily },
      { label: 'THIS WEEK', value: v.weeklyAvg },
      { label: 'THIS MONTH', value: v.monthlyAvg },
      { label: 'CURRENT STREAK', value: v.currentStreak },
      { label: 'LONGEST STREAK', value: v.longestStreak },
      { label: 'PROC COMPLETION', value: v.processCompletionRate },
      { label: 'PROC CONSISTENCY', value: v.processConsistency },
    ];
  });
}
