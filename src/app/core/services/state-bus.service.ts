import { Injectable, signal } from '@angular/core';

/**
 * A single revision counter bumped after every write. Feature components read it
 * inside a computed/effect so their derived views recompute after any mutation.
 */
@Injectable({ providedIn: 'root' })
export class StateBus {
  readonly revision = signal(0);

  bump(): void {
    this.revision.update((n) => n + 1);
  }
}
