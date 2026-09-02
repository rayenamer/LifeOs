import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GoalNode } from '../../core/models';
import { band } from '../pipes/pipes';

interface PlacedNode {
  node: GoalNode;
  x: number;
  y: number;
}

/**
 * Month-detail constellation: the month sits at the centre, each life-area goal
 * orbits it. Node ring fill = month-to-date execution; inner dot = today.
 */
@Component({
  selector: 'ui-radial-constellation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 520 520" role="group" [attr.aria-label]="centerLabel() + ' constellation'">
      <circle class="orbit" cx="260" cy="260" [attr.r]="orbit" />

      @for (p of placed(); track p.node.goal.id) {
        <line class="spoke" x1="260" y1="260" [attr.x2]="p.x" [attr.y2]="p.y" />
      }

      <!-- centre -->
      <circle class="core" cx="260" cy="260" r="52" />
      <text class="core-label" x="260" y="254" text-anchor="middle">{{ centerLabel() }}</text>
      <text class="core-score mono" x="260" y="284" text-anchor="middle">{{ centerScore() }}</text>

      @for (p of placed(); track p.node.goal.id) {
        <g
          class="node"
          [attr.transform]="'translate(' + p.x + ',' + p.y + ')'"
          role="button"
          tabindex="0"
          [attr.aria-label]="p.node.area.name + ', score ' + p.node.score"
          (click)="pick.emit(p.node)"
          (keydown.enter)="pick.emit(p.node)"
          (keydown.space)="pick.emit(p.node)"
        >
          <circle class="ring-bg" [attr.r]="nodeR(p.node)" />
          <circle
            class="ring"
            [attr.r]="nodeR(p.node)"
            [attr.stroke-dasharray]="dash(p.node.score, p.node)"
            [style.stroke]="color(p.node.score)"
            transform="rotate(-90)"
          />
          <circle class="today" [attr.r]="5 + 9 * p.node.todayCompletion" />
          <text class="n-label" [attr.y]="nodeR(p.node) + 22" text-anchor="middle">
            {{ p.node.area.name.toUpperCase() }} · {{ p.node.goal.weight }}
          </text>
          <text class="n-score mono" y="5" text-anchor="middle">{{ p.node.score }}</text>
        </g>
      }
    </svg>
  `,
  styles: [
    `
      svg {
        width: 100%;
        max-width: 520px;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .orbit {
        fill: none;
        stroke: var(--border);
        stroke-dasharray: 2 6;
      }
      .spoke {
        stroke: var(--border);
      }
      .core {
        fill: var(--bg-2);
        stroke: var(--border-1);
      }
      .core-label {
        fill: var(--text-2);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.16em;
      }
      .core-score {
        fill: var(--text);
        font-size: 22px;
      }
      .node {
        cursor: pointer;
      }
      .ring-bg {
        fill: var(--bg-1);
        stroke: var(--border);
      }
      .ring {
        fill: none;
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dasharray var(--dur-3) var(--ease);
      }
      .node:hover .ring-bg {
        stroke: var(--accent);
      }
      .today {
        fill: var(--accent);
        opacity: 0.85;
      }
      .n-label {
        fill: var(--text-2);
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.14em;
      }
      .n-score {
        fill: var(--text);
        font-size: 13px;
      }
      .node:focus-visible {
        outline: none;
      }
      .node:focus-visible .ring-bg {
        stroke: var(--accent);
        stroke-width: 2;
      }
    `,
  ],
})
export class RadialConstellationComponent {
  readonly nodes = input<GoalNode[]>([]);
  readonly centerLabel = input<string>('MONTH');
  readonly centerScore = input<number>(0);
  readonly pick = output<GoalNode>();

  readonly orbit = 170;

  readonly placed = computed<PlacedNode[]>(() => {
    const list = this.nodes();
    const n = list.length || 1;
    return list.map((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        node,
        x: 260 + Math.cos(angle) * this.orbit,
        y: 260 + Math.sin(angle) * this.orbit,
      };
    });
  });

  /** Node radius scales with the goal's share of the month (weight 0..100). */
  nodeR(node: GoalNode): number {
    const w = Math.max(0, Math.min(100, node.goal.weight || 0));
    return 24 + (w / 100) * 18;
  }

  dash(score: number, node: GoalNode): string {
    const c = 2 * Math.PI * this.nodeR(node);
    const on = c * Math.max(0, Math.min(1, score / 100));
    return `${on} ${c - on}`;
  }

  color(score: number): string {
    return `var(--score-${band(score)})`;
  }
}
