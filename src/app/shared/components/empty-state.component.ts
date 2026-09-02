import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="eyebrow">{{ eyebrow() }}</span>
      <h2 class="title mono">{{ title() }}</h2>
      <p class="body">{{ message() }}</p>
      @if (actionLabel() && actionLink()) {
        <a class="btn btn--primary" [routerLink]="actionLink()">{{ actionLabel() }}</a>
      }
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-4);
        text-align: center;
        padding: var(--s-9) var(--s-5);
        border: 1px dashed var(--border-1);
        border-radius: var(--r-3);
      }
      .title {
        font-size: clamp(22px, 4vw, 34px);
        letter-spacing: 0.04em;
        color: var(--text);
      }
      .body {
        max-width: 46ch;
        color: var(--text-1);
        font-size: 13px;
        line-height: 1.7;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly eyebrow = input<string>('SYSTEM');
  readonly title = input<string>('NOTHING HERE YET.');
  readonly message = input<string>('');
  readonly actionLabel = input<string>('');
  readonly actionLink = input<string | unknown[]>('');
}
