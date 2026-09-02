import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConsistencyService } from '../core/services/consistency.service';
import { currentMonth } from '../core/util/date';

interface NavItem {
  label: string;
  link: string[];
  glyph: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.nav-open]="navOpen()">
      <aside class="sidebar">
        <div class="brand">
          <a routerLink="/app/months" class="brand-mark mono">LIFE<span>OS</span></a>
          <button class="collapse" type="button" (click)="navOpen.set(false)" aria-label="Close navigation">✕</button>
        </div>

        <nav class="nav">
          @for (item of nav; track item.label) {
            <a
              [routerLink]="item.link"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }"
              class="nav-link"
              (click)="navOpen.set(false)"
            >
              <span class="glyph mono">{{ item.glyph }}</span>
              <span class="txt">{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-foot">
          <a routerLink="/app/goals/new" class="btn btn--primary new-goal" (click)="navOpen.set(false)">
            + NEW GOAL
          </a>
          <div class="streak-mini mono">
            <span class="dot" [class.paused]="streak().currentStreak === 0"></span>
            {{ streak().currentStreak }}-DAY STREAK
          </div>
        </div>
      </aside>

      <div class="backdrop" (click)="navOpen.set(false)"></div>

      <main class="canvas">
        <header class="topbar">
          <button class="menu" type="button" (click)="navOpen.set(true)" aria-label="Open navigation">☰</button>
          <a routerLink="/app/months" class="mono top-brand">LIFEOS</a>
          <a routerLink="/app/today" class="btn btn--ghost top-today">TODAY</a>
        </header>

        <div class="outlet">
          <router-outlet />
        </div>
      </main>

      <nav class="bottom-nav">
        @for (item of nav; track item.label) {
          <a [routerLink]="item.link" routerLinkActive="active" class="bn-link">
            <span class="glyph mono">{{ item.glyph }}</span>
            <span class="bn-txt">{{ item.label }}</span>
          </a>
        }
      </nav>
    </div>
  `,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private consistency = inject(ConsistencyService);
  readonly streak = this.consistency.streak;
  readonly navOpen = signal(false);

  private readonly mk = currentMonth();

  readonly nav: NavItem[] = [
    { label: 'Months', link: ['/app/months'], glyph: '▦' },
    { label: 'Today', link: ['/app/today'], glyph: '◈' },
    { label: 'Insights', link: ['/app/insights'], glyph: '◭' },
    { label: 'Reflection', link: ['/app/reflection'], glyph: '❖' },
    { label: 'Settings', link: ['/app/settings'], glyph: '⚙' },
  ];
}
