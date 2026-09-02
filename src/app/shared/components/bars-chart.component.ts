import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { NamedScore } from '../../core/models';
import { band } from '../pipes/pipes';

const BAND_COLOR: Record<string, string> = {
  void: '#3a3a3a',
  low: '#7a6a5c',
  mid: '#b8a06a',
  good: '#7fc8a9',
  high: '#4be3b0',
};

@Component({
  selector: 'ui-bars-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas baseChart type="bar" [data]="data()" [options]="options"></canvas>
    </div>
  `,
  styles: [
    `
      .chart {
        position: relative;
        width: 100%;
      }
    `,
  ],
})
export class BarsChartComponent {
  readonly scores = input<NamedScore[]>([]);
  readonly horizontal = input<boolean>(true);
  readonly height = input<number>(240);

  readonly data = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: this.scores().map((s) => s.label),
    datasets: [
      {
        data: this.scores().map((s) => s.score),
        backgroundColor: this.scores().map((s) => BAND_COLOR[band(s.score)]),
        borderWidth: 0,
        borderRadius: 2,
        barThickness: 'flex',
        maxBarThickness: 26,
      },
    ],
  }));

  get options(): ChartConfiguration<'bar'>['options'] {
    return {
      indexAxis: this.horizontal() ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b6b6b', font: { family: 'JetBrains Mono', size: 9 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#a8a8a8', font: { family: 'JetBrains Mono', size: 10 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#ededed',
          bodyColor: '#a8a8a8',
        },
      },
    };
  }
}
