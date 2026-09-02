import { Injectable, inject } from '@angular/core';
import {
  DailyExecution,
  DailyScore,
  HeatCell,
  InsightsView,
  MonthKey,
  MonthSummary,
  MonthlyReviewView,
  NamedScore,
  Process,
  TrendPoint,
  YearGroup,
} from '../models';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import { LifeAreaRepository } from '../repositories/life-area.repository';
import { MonthlyGoalRepository } from '../repositories/monthly-goal.repository';
import { ProcessRepository } from '../repositories/process.repository';
import { StreakRepository } from '../repositories/streak.repository';
import {
  MONTH_NAMES,
  addDays,
  currentMonth,
  dateRange,
  daysInMonth,
  isFutureMonth,
  monthEnd,
  monthStart,
  parseIso,
  sameMonth,
  today,
  weekStartOf,
} from '../util/date';
import { ScoringService } from './scoring.service';
import { SettingsService } from './settings.service';
import { StreakService } from './streak.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private areas = inject(LifeAreaRepository);
  private goals = inject(MonthlyGoalRepository);
  private processes = inject(ProcessRepository);
  private execs = inject(DailyExecutionRepository);
  private scores = inject(DailyScoreRepository);
  private streakRepo = inject(StreakRepository);
  private scoring = inject(ScoringService);
  private streak = inject(StreakService);
  private settings = inject(SettingsService);

  // --- month timeline -------------------------------------------------------

  monthTimeline(): YearGroup[] {
    const keys = this.timelineMonthKeys();
    const allScores = this.scores.all();
    const mvd = this.settings.minimumViableDay();
    const summaries = keys.map((k) => this.buildMonthSummary(k, allScores, mvd));

    const byYear = new Map<number, MonthSummary[]>();
    for (const s of summaries) {
      const list = byYear.get(s.year) ?? [];
      list.push(s);
      byYear.set(s.year, list);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({ year, months: months.sort((a, b) => b.month - a.month) }));
  }

  private timelineMonthKeys(): MonthKey[] {
    const goalMonths = this.goals.distinctMonths();
    const cur = currentMonth();
    const set = new Map<string, MonthKey>();
    const add = (k: MonthKey) => set.set(`${k.year}-${k.month}`, k);
    add(cur);
    for (const g of goalMonths) add(g);

    // fill any gaps between the earliest month and the current month
    const all = [...set.values()];
    let earliest = cur;
    for (const k of all) if (k.year < earliest.year || (k.year === earliest.year && k.month < earliest.month)) earliest = k;

    const filled: MonthKey[] = [];
    let y = earliest.year;
    let m = earliest.month;
    while (y < cur.year || (y === cur.year && m <= cur.month)) {
      filled.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return filled.sort((a, b) => b.year - a.year || b.month - a.month);
  }

  private buildMonthSummary(k: MonthKey, allScores: DailyScore[], mvd: number): MonthSummary {
    const cur = currentMonth();
    const isCurrent = sameMonth(k, cur);
    const isFuture = isFutureMonth(k);
    const total = daysInMonth(k.year, k.month);
    const elapsed = isFuture ? 0 : isCurrent ? parseIso(today()).getDate() : total;
    const start = monthStart(k.year, k.month);
    const end = monthEnd(k.year, k.month);

    const monthScores = allScores.filter((s) => s.date >= start && s.date <= end);
    const recorded = monthScores.filter((s) => s.date <= today());
    const score = recorded.length
      ? Math.round(recorded.reduce((a, s) => a + s.score, 0) / recorded.length)
      : 0;
    const activeDays = recorded.filter((s) => this.streak.isActiveDay(s, mvd)).length;

    const snapshot = isCurrent ? today() : end < today() ? end : today();
    const streakDays = this.streak.compute(allScores, mvd, snapshot).currentStreak;

    return {
      ...k,
      label: MONTH_NAMES[k.month - 1].toUpperCase(),
      score,
      activeGoals: this.goals.forMonth(k).length,
      consistency: elapsed ? activeDays / elapsed : 0,
      activeDays,
      elapsedDays: elapsed,
      totalDays: total,
      streakDays,
      isCurrent,
      isFuture,
      hasData: recorded.length > 0,
    };
  }

  // --- goal / area scoring -------------------------------------------------

  /** 0..100 month-to-date execution of one goal against its active processes. */
  goalScore(goalId: string, mk: MonthKey): number {
    const procs = this.processes.forGoal(goalId, true);
    if (!procs.length) return 0;
    const perDay = this.goalDailySeries(procs, mk);
    if (!perDay.length) return 0;
    return Math.round(perDay.reduce((a, b) => a + b, 0) / perDay.length);
  }

  private goalDailySeries(procs: Process[], mk: MonthKey): number[] {
    const start = monthStart(mk.year, mk.month);
    const rawEnd = monthEnd(mk.year, mk.month);
    const end = rawEnd < today() ? rawEnd : today();
    if (end < start) return [];
    const ids = procs.map((p) => p.id);
    const execs = groupByDate(this.execs.forProcessesInRange(ids, start, end));
    return dateRange(start, end).map((d) =>
      this.scoring.goalDayScore(procs, execs.get(d) ?? []),
    );
  }

  areaScoresForMonth(mk: MonthKey): NamedScore[] {
    return this.goals.forMonth(mk).map((g) => {
      const area = this.areas.byId(g.lifeAreaId);
      return {
        label: (area?.name ?? 'Area').toUpperCase(),
        score: this.goalScore(g.id, mk),
        sub: g.title,
      };
    });
  }

  processScoresForMonth(mk: MonthKey): NamedScore[] {
    const out: NamedScore[] = [];
    for (const g of this.goals.forMonth(mk)) {
      const area = this.areas.byId(g.lifeAreaId);
      const procs = this.processes.forGoal(g.id, true);
      const start = monthStart(mk.year, mk.month);
      const rawEnd = monthEnd(mk.year, mk.month);
      const end = rawEnd < today() ? rawEnd : today();
      if (end < start) continue;
      const days = dateRange(start, end);
      for (const p of procs) {
        const execs = groupByDate(this.execs.forProcessesInRange([p.id], start, end));
        const ratios = days.map((d) => {
          const list = execs.get(d) ?? [];
          return this.scoring.completionRatio(p, list.find((e) => e.processId === p.id) ?? null);
        });
        const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
        out.push({
          label: p.name,
          score: Math.round(avg * 100),
          sub: area?.name ?? '',
        });
      }
    }
    return out;
  }

  // --- insights ----------------------------------------------------------

  insights(): InsightsView {
    const mvd = this.settings.minimumViableDay();
    const allScores = this.scores.all();
    const streakData = this.streak.compute(allScores, mvd);
    const streakRow = this.streakRepo.get();
    const cur = currentMonth();

    const scoreVals = allScores.filter((s) => s.date <= today()).map((s) => s.score);
    const avgDaily = mean(scoreVals);

    const trend: TrendPoint[] = allScores
      .filter((s) => s.date <= today())
      .slice(-45)
      .map((s) => ({ date: s.date, score: s.score }));

    const weeklyAvg = this.weeklyAverage(allScores);
    const monthlyAvg = this.monthMeanScore(cur, allScores);

    const scoreByArea = this.areaScoresForMonth(cur).sort((a, b) => b.score - a.score);
    const scoreByProcess = this.processScoresForMonth(cur).sort((a, b) => b.score - a.score);
    const scoreByMonth = this.monthTimeline()
      .flatMap((g) => g.months)
      .filter((m) => m.hasData)
      .slice(0, 12)
      .reverse()
      .map((m) => ({ label: `${m.label.slice(0, 3)} ${String(m.year).slice(2)}`, score: m.score }));

    const { rate: processCompletionRate, consistency: processConsistency } =
      this.processExecutionStats();

    return {
      avgDaily,
      weeklyAvg,
      monthlyAvg,
      processCompletionRate,
      processConsistency,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      activeDays: streakData.activeDays,
      missedDays: streakData.missedDays,
      freezeDaysUsed: streakRow.freezeDaysUsed,
      scoreByArea,
      scoreByMonth,
      scoreByProcess,
      strongestProcess: scoreByProcess[0] ?? null,
      weakestProcess: scoreByProcess.length ? scoreByProcess[scoreByProcess.length - 1] : null,
      trend,
      heatmap: this.heatmap(126),
    };
  }

  heatmap(days: number): HeatCell[] {
    const mvd = this.settings.minimumViableDay();
    const end = today();
    const start = addDays(end, -(days - 1));
    const byDate = new Map(this.scores.inRange(start, end).map((s) => [s.date, s]));
    // pad to a whole number of weeks starting Monday
    const gridStart = weekStartOf(start);
    return dateRange(gridStart, end).map((date) => {
      const s = byDate.get(date) ?? null;
      return {
        date,
        score: s?.score ?? 0,
        band: this.scoring.band(s?.score ?? 0),
        isFreeze: s?.isFreezeDay ?? false,
        inRange: date >= start,
      };
    });
  }

  private processExecutionStats(): { rate: number; consistency: number } {
    const start = addDays(today(), -29);
    const end = today();
    const goalIds = this.goals
      .distinctMonths()
      .flatMap((mk) => this.goals.forMonth(mk))
      .map((g) => g.id);
    const procs = this.processes.forGoals([...new Set(goalIds)], true);
    if (!procs.length) return { rate: 0, consistency: 0 };
    const execs = this.execs.forProcessesInRange(procs.map((p) => p.id), start, end);
    const byProcess = new Map<string, DailyExecution[]>();
    for (const e of execs) {
      const list = byProcess.get(e.processId) ?? [];
      list.push(e);
      byProcess.set(e.processId, list);
    }
    const perProc = procs.map((p) => {
      const list = byProcess.get(p.id) ?? [];
      const done = list.filter((e) => this.scoring.completionRatio(p, e) >= 0.999).length;
      const engaged = list.length;
      return { rate: engaged ? done / engaged : 0, consistency: engaged / 30 };
    });
    return {
      rate: Math.round(mean(perProc.map((x) => x.rate * 100))),
      consistency: Math.round(mean(perProc.map((x) => Math.min(1, x.consistency) * 100))),
    };
  }

  private weeklyAverage(allScores: DailyScore[]): number {
    const start = weekStartOf(today());
    const vals = allScores.filter((s) => s.date >= start && s.date <= today()).map((s) => s.score);
    return mean(vals);
  }

  monthMeanScore(mk: MonthKey, allScores = this.scores.all()): number {
    const start = monthStart(mk.year, mk.month);
    const end = monthEnd(mk.year, mk.month);
    const vals = allScores
      .filter((s) => s.date >= start && s.date <= end && s.date <= today())
      .map((s) => s.score);
    return mean(vals);
  }

  // --- monthly review --------------------------------------------------

  monthlyReview(mk: MonthKey): MonthlyReviewView {
    const mvd = this.settings.minimumViableDay();
    const allScores = this.scores.all();
    const areaScores = this.areaScoresForMonth(mk).sort((a, b) => b.score - a.score);
    const processScores = this.processScoresForMonth(mk).sort((a, b) => b.score - a.score);
    const total = daysInMonth(mk.year, mk.month);
    const start = monthStart(mk.year, mk.month);
    const end = monthEnd(mk.year, mk.month);
    const monthScoreRows = allScores.filter((s) => s.date >= start && s.date <= end && s.date <= today());
    const activeDays = monthScoreRows.filter((s) => this.streak.isActiveDay(s, mvd)).length;

    const prev = prevMonth(mk);
    const prevAreas = new Map(this.areaScoresForMonth(prev).map((a) => [a.label, a.score]));
    let biggestDrop: NamedScore | null = null;
    for (const a of areaScores) {
      const before = prevAreas.get(a.label);
      if (before == null) continue;
      const delta = a.score - before;
      if (delta < 0 && (!biggestDrop || delta < (biggestDrop.score ?? 0))) {
        biggestDrop = { label: a.label, score: delta, sub: `${before} → ${a.score}` };
      }
    }

    return {
      ...mk,
      label: `${MONTH_NAMES[mk.month - 1].toUpperCase()} ${mk.year}`,
      monthScore: this.monthMeanScore(mk, allScores),
      areaScores,
      bestProcess: processScores[0] ?? null,
      weakestProcess: processScores.length ? processScores[processScores.length - 1] : null,
      mostConsistentArea: areaScores[0] ?? null,
      biggestDrop,
      streakDays: this.streak.compute(allScores, mvd, end < today() ? end : today()).currentStreak,
      activeDays,
      totalDays: total,
    };
  }
}

// --- helpers -------------------------------------------------------------

function groupByDate(execs: DailyExecution[]): Map<string, DailyExecution[]> {
  const m = new Map<string, DailyExecution[]>();
  for (const e of execs) {
    const list = m.get(e.date) ?? [];
    list.push(e);
    m.set(e.date, list);
  }
  return m;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function prevMonth(mk: MonthKey): MonthKey {
  return mk.month === 1 ? { year: mk.year - 1, month: 12 } : { year: mk.year, month: mk.month - 1 };
}
