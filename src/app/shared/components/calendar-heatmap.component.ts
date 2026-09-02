import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeatCell } from '../../core/models';
import { parseIso, shortDate } from '../../core/util/date';

interface Col {
  cells: (HeatCell | null)[];
}

/** GitHub-style consistency calendar. Freeze days are visibly distinct (ringed). */
@Component({
  selector: 'ui-calendar-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroll-x">
      <svg [attr.width]="width()" [attr.height]="height" role="img" aria-label="Daily consistency calendar">
        @for (col of columns(); track $index; let ci = $index) {
          @for (cell of col.cells; track $index; let ri = $index) {
            @if (cell) {
              <rect
                [attr.x]="ci * (cell1 + gap)"
                [attr.y]="ri * (cell1 + gap)"
                [attr.width]="cell1"
                [attr.height]="cell1"
                rx="1.5"
                [attr.fill]="fill(cell)"
                [attr.stroke]="cell.isFreeze ? 'var(--freeze)' : 'transparent'"
                stroke-width="1.5"
                [attr.opacity]="cell.inRange ? 1 : 0.25"
              >
                <title>{{ shortDate(cell.date) }} · {{ cell.score }}{{ cell.isFreeze ? ' · freeze' : '' }}</title>
              </rect>
            }
          }
        }
      </svg>
    </div>
    <div class="legend mono">
      <span>LESS</span>
      <span class="sw" style="background:var(--score-void)"></span>
      <span class="sw" style="background:var(--score-low)"></span>
      <span class="sw" style="background:var(--score-mid)"></span>
      <span class="sw" style="background:var(--score-good)"></span>
      <span class="sw" style="background:var(--score-high)"></span>
      <span>MORE</span>
      <span class="sw ring"></span>
      <span>FREEZE</span>
    </div>
  `,
  styles: [
    `
      svg {
        display: block;
      }
      .legend {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: var(--s-3);
        font-size: 9px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .sw {
        width: 11px;
        height: 11px;
        border-radius: 2px;
        display: inline-block;
      }
      .sw.ring {
        border: 1.5px solid var(--freeze);
        background: var(--score-void);
      }
    `,
  ],
})
export class CalendarHeatmapComponent {
  readonly cells = input<HeatCell[]>([]);

  readonly cell1 = 13;
  readonly gap = 3;
  readonly height = 7 * (this.cell1 + this.gap);

  readonly columns = computed<Col[]>(() => {
    const cols: Col[] = [];
    const list = this.cells();
    for (let i = 0; i < list.length; i += 7) {
      const week = list.slice(i, i + 7);
      // pad to 7 (last partial week)
      const cells: (HeatCell | null)[] = [];
      for (let d = 0; d < 7; d++) cells.push(week[d] ?? null);
      cols.push({ cells });
    }
    return cols;
  });

  readonly width = computed(() => this.columns().length * (this.cell1 + this.gap));

  fill(cell: HeatCell): string {
    return `var(--score-${cell.band})`;
  }

  shortDate = shortDate;
  parseIso = parseIso;
}
