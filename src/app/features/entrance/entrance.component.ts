import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-entrance',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="entrance">
      <div class="grid-fade"></div>
      <div class="inner">
        <span class="eyebrow reveal d0">PERSONAL BEHAVIORAL SYSTEM</span>
        <h1 class="statement">
          <span class="reveal d1">You don't control the outcome.</span>
          <span class="reveal d2">You control what you do today.</span>
        </h1>
        <a routerLink="/app/months" class="enter reveal d4">
          ENTER LIFEOS <span class="arrow">→</span>
        </a>
        <p class="foot reveal d4">DATA, NOT JUDGMENT · CONSISTENCY &gt; PERFECTION</p>
      </div>
    </section>
  `,
  styles: [
    `
      .entrance {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: radial-gradient(ellipse 80% 60% at 50% 40%, #0b0b0b, #050505 70%);
        overflow: hidden;
      }
      .grid-fade {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(var(--grid-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, #000, transparent 80%);
      }
      .inner {
        position: relative;
        z-index: 1;
        max-width: 680px;
        padding: var(--s-6);
        display: flex;
        flex-direction: column;
        gap: var(--s-5);
        text-align: center;
      }
      .statement {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        font-size: clamp(26px, 5.4vw, 46px);
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.12;
        color: var(--text);
      }
      .statement span:last-child {
        color: var(--accent);
      }
      .sub {
        color: var(--text-1);
        font-size: 14px;
        line-height: 1.7;
        max-width: 52ch;
        margin: 0 auto;
      }
      .enter {
        align-self: center;
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        margin-top: var(--s-3);
        padding: 14px 26px;
        border: 1px solid var(--accent);
        border-radius: var(--r-2);
        background: var(--accent-dim);
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.24em;
        color: var(--text);
        transition: box-shadow var(--dur-2) var(--ease), transform var(--dur-1) var(--ease);
      }
      .enter:hover {
        box-shadow: 0 0 0 1px var(--accent), 0 0 40px -8px var(--accent-glow);
        transform: translateY(-1px);
      }
      .arrow {
        transition: transform var(--dur-1) var(--ease);
      }
      .enter:hover .arrow {
        transform: translateX(4px);
      }
      .foot {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--text-3);
      }
      .reveal {
        opacity: 0;
        transform: translateY(10px);
        animation: rise var(--dur-3) var(--ease) forwards;
      }
      .d0 { animation-delay: 0.05s; }
      .d1 { animation-delay: 0.18s; }
      .d2 { animation-delay: 0.34s; }
      .d3 { animation-delay: 0.5s; }
      .d4 { animation-delay: 0.66s; }
      @keyframes rise {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .reveal {
          opacity: 1;
          transform: none;
          animation: none;
        }
      }
    `,
  ],
})
export class EntranceComponent {}
