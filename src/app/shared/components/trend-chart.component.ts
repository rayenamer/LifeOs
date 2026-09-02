import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TrendPoint } from '../../core/models';
import { shortDate } from '../../core/util/date';

@Component({
  selector: 'ui-trend-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <canvas baseChart type="line" [data]="data()" [options]="options"></canvas>
    </div>
  `,
  styles: [
    `
      .chart {
        position: relative;
        height: 240px;
        width: 100%;
      }
    `,
  ],
})
export class TrendChartComponent {
  readonly points = input<TrendPoint[]>([]);

  readonly data = computed<ChartConfiguration<'line'>['data']>(() => ({
    labels: this.points().map((p) => shortDate(p.date)),
    datasets: [
      {
        data: this.points().map((p) => p.score),
        borderColor: 'rgba(0,240,255,0.9)',
        backgroundColor: 'rgba(0,240,255,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5,
      },
    ],
  }));

  readonly options: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6b6b6b', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6b6b6b', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 25 },
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
        bodyFont: { family: 'JetBrains Mono' },
      },
    },
  };
}
