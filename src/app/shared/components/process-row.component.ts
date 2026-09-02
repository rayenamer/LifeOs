import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProcessExecutionRow } from '../../core/models';
import { WeightBarComponent } from './weight-bar.component';

/**
 * One executable process on the Today screen / Goal Detail list. Binary
 * processes toggle; quantitative processes take a value against their target.
 */
@Component({
  selector: 'ui-process-row',
  standalone: true,
  imports: [FormsModule, WeightBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pr" [class.done]="done()">
      <button
        class="check"
        type="button"
        [attr.aria-pressed]="done()"
        [attr.aria-label]="'Toggle ' + row().process.name"
        (click)="toggle.emit()"
      >
        @if (done()) { <span class="tick">✓</span> } @else { <span class="dot"></span> }
      </button>

      <div class="body">
        <div class="top">
          <span class="name">{{ row().process.name }}</span>
          <span class="weight mono">{{ row().process.weight }}</span>
        </div>
        @if (row().process.description) {
          <p class="desc">{{ row().process.description }}</p>
        }
        <ui-weight-bar [weight]="row().process.weight" [ratio]="ratio()" />
      </div>

      <div class="control">
        @if (quantitative()) {
          <label class="qty">
            <input
              class="input"
              type="number"
              inputmode="numeric"
              min="0"
              [ngModel]="row().today?.actualValue ?? null"
              (ngModelChange)="setValue.emit(coerce($event))"
              [attr.aria-label]="row().process.name + ' value'"
            />
            <span class="target mono">/ {{ row().process.targetValue }} {{ row().process.unit }}</span>
          </label>
        } @else {
          <span class="status mono">{{ done() ? 'DONE' : '—' }}</span>
        }
        <span class="pts mono" [class.zero]="row().todayContribution === 0">
          +{{ row().todayContribution }}
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      .pr {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        gap: var(--s-4);
        align-items: start;
        padding: var(--s-4) 0;
        border-bottom: 1px solid var(--border);
      }
      .pr:last-child {
        border-bottom: none;
      }
      .check {
        width: 24px;
        height: 24px;
        border: 1px solid var(--border-1);
        border-radius: var(--r-1);
        display: grid;
        place-items: center;
        transition: border-color var(--dur-1) var(--ease), background var(--dur-1) var(--ease);
        margin-top: 2px;
      }
      .check:hover {
        border-color: var(--accent);
      }
      .done .check {
        border-color: var(--accent);
        background: var(--accent-dim);
      }
      .tick {
        color: var(--accent);
        font-size: 13px;
      }
      .dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--text-3);
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        min-width: 0;
      }
      .top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s-3);
      }
      .name {
        font-size: 14px;
        color: var(--text);
      }
      .done .name {
        color: var(--text-1);
      }
      .weight {
        font-size: 12px;
        color: var(--text-2);
      }
      .desc {
        font-size: 12px;
        color: var(--text-2);
      }
      .control {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--s-2);
        white-space: nowrap;
      }
      .qty {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
      }
      .qty .input {
        width: 62px;
        padding: 6px 8px;
        text-align: right;
        font-family: var(--font-mono);
      }
      .target {
        font-size: 11px;
        color: var(--text-2);
      }
      .status {
        font-size: 11px;
        letter-spacing: 0.16em;
        color: var(--text-2);
      }
      .pts {
        font-size: 13px;
        color: var(--score-high);
      }
      .pts.zero {
        color: var(--text-3);
      }
      @media (max-width: 560px) {
        .pr {
          grid-template-columns: 24px 1fr;
        }
        .control {
          grid-column: 2;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
      }
    `,
  ],
})
export class ProcessRowComponent {
  readonly row = input.required<ProcessExecutionRow>();
  readonly toggle = output<void>();
  readonly setValue = output<number>();

  readonly quantitative = computed(() => this.row().process.targetValue > 1);
  readonly ratio = computed(() => {
    const r = this.row();
    const t = r.today;
    if (this.quantitative()) {
      const v = t?.actualValue ?? (t?.completed ? r.process.targetValue : 0);
      return Math.max(0, Math.min(1, v / r.process.targetValue));
    }
    return t?.completed ? 1 : 0;
  });
  readonly done = computed(() => this.ratio() >= 0.999);

  coerce(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}
