import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StateBus } from '../../core/services/state-bus.service';
import { WeekService } from '../../core/services/week.service';
import { ScoreColorPipe, WeekRangePipe } from '../../shared/pipes/pipes';

@Component({
  selector: 'app-weekly-review-list',
  standalone: true,
  imports: [RouterLink, WeekRangePipe, ScoreColorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <span class="eyebrow">RETROSPECTIVE</span>
      <h1>Weekly Reflection</h1>
      <p class="lede">
        Once a week: what went well, what didn't, what to change. The loop is
        review → adjust the system → run it again.
      </p>
    </header>

    <div class="weeks">
      @for (w of weeks(); track w.weekStart) {
        <a class="week" [class.current]="w.isCurrent" [routerLink]="['/app/reflection', w.weekStart]">
          <div class="w-main">
            <span class="w-num mono">WEEK {{ w.weekNumber }}</span>
            <span class="w-range mono">{{ w.weekStart | weekRange }}</span>
          </div>
          <div class="w-right">
            <span class="w-score mono" [style.color]="w.avgScore | scoreColor">{{ w.avgScore || '—' }}</span>
            <span class="w-state mono" [class.done]="w.completed">
              {{ w.completed ? 'REFLECTED' : (w.isCurrent ? 'OPEN' : 'MISSED') }}
            </span>
          </div>
        </a>
      }
    </div>
  `,
  styles: [
    `
      .page-head { display: flex; flex-direction: column; gap: var(--s-3); margin-bottom: var(--s-6); }
      h1 { font-size: clamp(24px, 4vw, 32px); }
      .lede { color: var(--text-1); font-size: 13px; line-height: 1.7; max-width: 56ch; }
      .weeks { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--r-3); overflow: hidden; }
      .week {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding: var(--s-4) var(--s-5);
        border-bottom: 1px solid var(--border);
        transition: background var(--dur-1) var(--ease);
      }
      .week:last-child { border-bottom: none; }
      .week:hover { background: var(--surface-glass); }
      .week.current { background: var(--accent-dim); }
      .w-main { display: flex; flex-direction: column; gap: 3px; }
      .w-num { font-size: 12px; color: var(--text); letter-spacing: 0.1em; }
      .w-range { font-size: 10px; color: var(--text-2); letter-spacing: 0.1em; }
      .w-right { display: flex; align-items: center; gap: var(--s-4); }
      .w-score { font-size: 20px; letter-spacing: -0.03em; }
      .w-state { font-size: 9px; letter-spacing: 0.16em; color: var(--text-3); }
      .w-state.done { color: var(--score-high); }
    `,
  ],
})
export class WeeklyReviewListComponent {
  private week = inject(WeekService);
  private bus = inject(StateBus);

  readonly weeks = computed(() => {
    this.bus.revision();
    return this.week.recentWeeks(12);
  });
}
