import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { band } from '../pipes/pipes';

/**
 * Large circular score indicator. The number is competence feedback — data, not
 * judgment — so it is shown plainly, without percentage signs or celebration.
 */
@Component({
  selector: 'ui-score-dial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dial" [style.--size.px]="size()">
      <svg [attr.viewBox]="'0 0 ' + box + ' ' + box" aria-hidden="true">
        <circle class="track" [attr.cx]="c" [attr.cy]="c" [attr.r]="r" [attr.stroke-width]="stroke" />
        <circle
          class="value"
          [attr.cx]="c"
          [attr.cy]="c"
          [attr.r]="r"
          [attr.stroke-width]="stroke"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset()"
          [style.stroke]="color()"
          [attr.transform]="'rotate(-90 ' + c + ' ' + c + ')'"
        />
      </svg>
      <div class="readout">
        <span class="num mono">{{ display() }}</span>
        @if (label()) {
          <span class="lbl">{{ label() }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .dial {
        position: relative;
        width: var(--size);
        height: var(--size);
        display: grid;
        place-items: center;
      }
      svg {
        width: 100%;
        height: 100%;
      }
      .track {
        fill: none;
        stroke: var(--border);
      }
      .value {
        fill: none;
        stroke-linecap: round;
        transition: stroke-dashoffset var(--dur-3) var(--ease), stroke var(--dur-2) var(--ease);
        filter: drop-shadow(0 0 6px var(--accent-glow));
      }
      .readout {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }
      .num {
        font-size: calc(var(--size) * 0.30);
        font-weight: 500;
        letter-spacing: -0.03em;
        color: var(--text);
        line-height: 1;
      }
      .lbl {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--text-2);
      }
    `,
  ],
})
export class ScoreDialComponent {
  readonly score = input<number>(0);
  readonly size = input<number>(180);
  readonly label = input<string>('');

  readonly box = 100;
  readonly c = 50;
  readonly stroke = 6;
  readonly r = 50 - this.stroke;
  readonly circumference = 2 * Math.PI * this.r;

  readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.score()))));
  readonly display = computed(() => this.clamped());
  readonly offset = computed(() => this.circumference * (1 - this.clamped() / 100));
  readonly color = computed(() => `var(--score-${band(this.clamped())})`);
}
