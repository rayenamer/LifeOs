import { Pipe, PipeTransform } from '@angular/core';
import { MonthKey, ScoreBand } from '../../core/models';
import { MONTH_NAMES, ordinal, parseIso, shortDate, weekEndOf } from '../../core/util/date';

/** Maps a 0..100 score to a CSS color var from the score scale. */
@Pipe({ name: 'scoreColor', standalone: true })
export class ScoreColorPipe implements PipeTransform {
  transform(score: number | null | undefined): string {
    return `var(--score-${band(score ?? 0)})`;
  }
}

export function band(score: number): ScoreBand {
  if (score <= 0) return 'void';
  if (score < 40) return 'low';
  if (score < 65) return 'mid';
  if (score < 85) return 'good';
  return 'high';
}

@Pipe({ name: 'monthName', standalone: true })
export class MonthNamePipe implements PipeTransform {
  transform(month: number, style: 'long' | 'short' = 'long'): string {
    const name = MONTH_NAMES[(month - 1 + 12) % 12] ?? '';
    return style === 'short' ? name.slice(0, 3).toUpperCase() : name.toUpperCase();
  }
}

@Pipe({ name: 'ordinalDate', standalone: true })
export class OrdinalDatePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = parseIso(iso);
    return `${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()]}`;
  }
}

@Pipe({ name: 'weekRange', standalone: true })
export class WeekRangePipe implements PipeTransform {
  transform(weekStart: string | null | undefined): string {
    if (!weekStart) return '—';
    return `${shortDate(weekStart)} — ${shortDate(weekEndOf(weekStart))}`;
  }
}

@Pipe({ name: 'mk', standalone: true })
export class MonthKeyLabelPipe implements PipeTransform {
  transform(mk: MonthKey): string {
    return `${MONTH_NAMES[mk.month - 1].toUpperCase()} ${mk.year}`;
  }
}
