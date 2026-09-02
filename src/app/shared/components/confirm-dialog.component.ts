import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="cancel.emit()">
        <div
          class="dialog panel"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <h3 class="section-title">{{ title() }}</h3>
          <p class="msg">{{ message() }}</p>
          <div class="actions">
            <button class="btn btn--ghost" type="button" (click)="cancel.emit()">
              {{ cancelLabel() }}
            </button>
            <button
              class="btn"
              [class.btn--danger]="danger()"
              [class.btn--primary]="!danger()"
              type="button"
              (click)="confirm.emit()"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        background: rgba(0, 0, 0, 0.66);
        backdrop-filter: blur(2px);
        display: grid;
        place-items: center;
        padding: var(--s-5);
      }
      .dialog {
        width: min(440px, 100%);
        padding: var(--s-6);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
      }
      .msg {
        color: var(--text-1);
        font-size: 13px;
        line-height: 1.7;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--s-3);
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Are you sure?');
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly danger = input<boolean>(false);
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
