import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { band } from '../pipes/pipes';

/** A thin horizontal bar: full width = the process weight, fill = today's execution. */
@Component({
  selector: 'ui-weight-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" [style.--w]="widthPct()">
      <div class="fill" [style.width.%]="fillPct()" [style.background]="color()"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .bar {
        position: relative;
        width: var(--w);
        height: 4px;
        background: var(--bg-3);
        border-radius: 2px;
        overflow: hidden;
        transition: width var(--dur-2) var(--ease);
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 2px;
        transition: width var(--dur-2) var(--ease), background var(--dur-2) var(--ease);
      }
    `,
  ],
})
export class WeightBarComponent {
  /** 0..100 process weight — sets the track width relative to a full goal. */
  readonly weight = input<number>(100);
  /** 0..1 completion ratio for the day. */
  readonly ratio = input<number>(0);

  readonly widthPct = computed(() => `${Math.max(6, Math.min(100, this.weight()))}%`);
  readonly fillPct = computed(() => Math.max(0, Math.min(1, this.ratio())) * 100);
  readonly color = computed(() => `var(--score-${band(this.ratio() * 100)})`);
}
