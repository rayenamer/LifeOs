import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Streak } from '../../core/models';

/**
 * Streak display. Consistency, not perfection: when the streak is 0 the copy
 * reassures rather than scolds — "The streak paused. Your progress didn't."
 */
@Component({
  selector: 'ui-streak-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [class.paused]="paused()">
      <div class="row">
        <span class="n mono">{{ streak().currentStreak }}</span>
        <span class="unit">{{ streak().currentStreak === 1 ? 'day' : 'days' }}</span>
      </div>
      <p class="msg">
        @if (paused()) {
          The streak paused. Your progress didn't.
        } @else {
          Consecutive days of meaningful engagement.
        }
      </p>
      <div class="meta mono">
        <span>LONGEST {{ streak().longestStreak }}</span>
        <span>FREEZE {{ streak().freezeDaysAvailable }} LEFT</span>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
      }
      .row {
        display: flex;
        align-items: baseline;
        gap: var(--s-2);
      }
      .n {
        font-size: 48px;
        font-weight: 500;
        letter-spacing: -0.04em;
        color: var(--accent);
        line-height: 1;
      }
      .paused .n {
        color: var(--text-1);
      }
      .unit {
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-2);
      }
      .msg {
        font-size: 13px;
        color: var(--text-1);
        max-width: 32ch;
      }
      .meta {
        display: flex;
        gap: var(--s-4);
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
    `,
  ],
})
export class StreakBadgeComponent {
  readonly streak = input.required<Streak>();
  readonly paused = computed(() => this.streak().currentStreak === 0 && this.streak().longestStreak > 0);
}
