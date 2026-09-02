import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../core/services/analytics.service';
import { StateBus } from '../../core/services/state-bus.service';
import { currentMonth } from '../../core/util/date';
import { BarsChartComponent } from '../../shared/components/bars-chart.component';
import { ScoreDialComponent } from '../../shared/components/score-dial.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ScoreColorPipe } from '../../shared/pipes/pipes';

@Component({
  selector: 'app-monthly-review',
  standalone: true,
  imports: [RouterLink, BarsChartComponent, ScoreDialComponent, EmptyStateComponent, ScoreColorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <a [routerLink]="['/app/months', mk().year, mk().month]" class="back mono">← MONTH DETAIL</a>
      <span class="eyebrow">MONTHLY REVIEW</span>
      <h1>{{ v().label }}</h1>
    </header>

    @if (!v().areaScores.length) {
      <ui-empty-state
        title="NOTHING TO REVIEW."
        message="This month has no goals or recorded execution."
        actionLabel="BACK TO MONTHS"
        actionLink="/app/months"
      />
    } @else {
      <section class="summary panel">
        <ui-score-dial [score]="v().monthScore" [size]="168" label="Month score" />
        <dl class="stats mono">
          <div><dt>ACTIVE DAYS</dt><dd>{{ v().activeDays }} / {{ v().totalDays }}</dd></div>
          <div><dt>STREAK AT MONTH END</dt><dd>{{ v().streakDays }}</dd></div>
          <div><dt>LIFE AREAS</dt><dd>{{ v().areaScores.length }}</dd></div>
        </dl>
      </section>

      <section class="panel block">
        <h2 class="section-title">SCORE BY LIFE AREA</h2>
        <ui-bars-chart [scores]="v().areaScores" [height]="Math.max(140, v().areaScores.length * 46)" />
      </section>

      <div class="cards">
        <div class="card panel">
          <span class="c-lbl mono">STRONGEST PROCESS</span>
          @if (v().bestProcess) {
            <span class="c-val">{{ v().bestProcess!.label }}</span>
            <span class="c-num mono" [style.color]="v().bestProcess!.score | scoreColor">{{ v().bestProcess!.score }}</span>
          } @else { <span class="c-val dim">—</span> }
        </div>
        <div class="card panel">
          <span class="c-lbl mono">NEEDS ATTENTION</span>
          @if (v().weakestProcess) {
            <span class="c-val">{{ v().weakestProcess!.label }}</span>
            <span class="c-num mono" [style.color]="v().weakestProcess!.score | scoreColor">{{ v().weakestProcess!.score }}</span>
          } @else { <span class="c-val dim">—</span> }
        </div>
        <div class="card panel">
          <span class="c-lbl mono">MOST CONSISTENT AREA</span>
          @if (v().mostConsistentArea) {
            <span class="c-val">{{ v().mostConsistentArea!.label }}</span>
            <span class="c-num mono" [style.color]="v().mostConsistentArea!.score | scoreColor">{{ v().mostConsistentArea!.score }}</span>
          } @else { <span class="c-val dim">—</span> }
        </div>
        <div class="card panel">
          <span class="c-lbl mono">BIGGEST DROP VS LAST MONTH</span>
          @if (v().biggestDrop) {
            <span class="c-val">{{ v().biggestDrop!.label }}</span>
            <span class="c-num mono drop">{{ v().biggestDrop!.score }}</span>
            <span class="c-sub mono">{{ v().biggestDrop!.sub }}</span>
          } @else { <span class="c-val dim">NO REGRESSIONS</span> }
        </div>
      </div>

      <p class="closing mono">
        A review is a systems check. Adjust one process, then run the next month.
      </p>
    }
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-6); }
      .back { font-size: 10px; letter-spacing: 0.16em; color: var(--text-2); }
      .back:hover { color: var(--accent); }
      h1 { font-size: clamp(22px, 4vw, 30px); }
      .summary {
        display: flex;
        align-items: center;
        gap: var(--s-7);
        padding: var(--s-6);
        margin-bottom: var(--s-4);
        flex-wrap: wrap;
      }
      .stats { display: flex; flex-direction: column; gap: var(--s-4); }
      .stats dt { font-size: 9px; letter-spacing: 0.16em; color: var(--text-3); }
      .stats dd { font-size: 22px; color: var(--text); margin-top: 2px; }
      .block { padding: var(--s-5); margin-bottom: var(--s-4); }
      .block h2 { margin-bottom: var(--s-4); }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--s-3);
      }
      .card {
        padding: var(--s-4);
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
      }
      .c-lbl { font-size: 9px; letter-spacing: 0.14em; color: var(--text-3); }
      .c-val { font-size: 14px; color: var(--text); }
      .c-val.dim { color: var(--text-3); }
      .c-num { font-size: 28px; letter-spacing: -0.03em; }
      .c-num.drop { color: var(--danger); }
      .c-sub { font-size: 10px; color: var(--text-2); }
      .closing {
        margin-top: var(--s-5);
        text-align: center;
        font-size: 10px;
        letter-spacing: 0.14em;
        color: var(--text-3);
      }
    `,
  ],
})
export class MonthlyReviewComponent {
  private analytics = inject(AnalyticsService);
  private bus = inject(StateBus);

  readonly Math = Math;
  readonly year = input.required<string>();
  readonly month = input.required<string>();

  readonly mk = computed(() => {
    const y = Number(this.year());
    const m = Number(this.month());
    return Number.isFinite(y) && Number.isFinite(m) ? { year: y, month: m } : currentMonth();
  });

  readonly v = computed(() => {
    this.bus.revision();
    return this.analytics.monthlyReview(this.mk());
  });
}
