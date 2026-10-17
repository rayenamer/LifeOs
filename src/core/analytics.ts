import type {
  DailyExecution,
  DailyScore,
  GoalDetailView,
  GoalNode,
  HeatCell,
  InsightsView,
  MonthKey,
  MonthlyReviewView,
  MonthSummary,
  NamedScore,
  Process,
  ProcessExecutionRow,
  ScorePoint,
  ScoreSeries,
  TodayAreaGroup,
  TodayView,
  YearGroup,
} from './models';
import { areaRepo, execRepo, goalRepo, processRepo, scoreRepo, streakRepo } from './repos';
import { scoring } from './scoring';
import { settings } from './services';
import { streakCalc } from './streak';
import {
  addDays,
  currentMonth,
  dateRange,
  daysInMonth,
  isFutureMonth,
  MONTH_NAMES,
  monthEnd,
  monthOf,
  monthStart,
  parseIso,
  sameMonth,
  today,
  weekStartOf,
} from './date';

const mean = (v: number[]): number => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0);

function groupByDate(execs: DailyExecution[]): Map<string, DailyExecution[]> {
  const m = new Map<string, DailyExecution[]>();
  for (const e of execs) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  return m;
}

export const prevMonth = (mk: MonthKey): MonthKey =>
  mk.month === 1 ? { year: mk.year - 1, month: 12 } : { year: mk.year, month: mk.month - 1 };

/** Elapsed range of a month, clamped to today. Null for a future month. */
function elapsedRange(mk: MonthKey): [string, string] | null {
  const start = monthStart(mk.year, mk.month);
  const rawEnd = monthEnd(mk.year, mk.month);
  const end = rawEnd < today() ? rawEnd : today();
  return end < start ? null : [start, end];
}

export const analytics = {
  // --- month timeline -------------------------------------------------------

  monthTimeline(): YearGroup[] {
    const cur = currentMonth();
    const keys = new Map<string, MonthKey>([[`${cur.year}-${cur.month}`, cur]]);
    for (const g of goalRepo.distinctMonths()) keys.set(`${g.year}-${g.month}`, g);

    let earliest = cur;
    for (const k of keys.values()) if (k.year < earliest.year || (k.year === earliest.year && k.month < earliest.month)) earliest = k;
    const filled: MonthKey[] = [];
    for (let y = earliest.year, m = earliest.month; y < cur.year || (y === cur.year && m <= cur.month); ) {
      filled.push({ year: y, month: m });
      if (++m > 12) { m = 1; y++; }
    }
    // planned future months (goals created ahead of time)
    for (const k of keys.values()) if (isFutureMonth(k)) filled.push(k);

    const allScores = scoreRepo.all();
    const mvd = settings.mvd();
    const byYear = new Map<number, MonthSummary[]>();
    for (const k of filled) {
      const s = analytics.monthSummary(k, allScores, mvd);
      byYear.set(k.year, [...(byYear.get(k.year) ?? []), s]);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({ year, months: months.sort((a, b) => b.month - a.month) }));
  },

  monthSummary(k: MonthKey, allScores: DailyScore[], mvd: number): MonthSummary {
    const isCurrent = sameMonth(k, currentMonth());
    const isFuture = isFutureMonth(k);
    const total = daysInMonth(k.year, k.month);
    const elapsed = isFuture ? 0 : isCurrent ? parseIso(today()).getDate() : total;
    const start = monthStart(k.year, k.month);
    const end = monthEnd(k.year, k.month);
    const recorded = allScores.filter((s) => s.date >= start && s.date <= end && s.date <= today());
    const activeDays = recorded.filter((s) => streakCalc.isActiveDay(s, mvd)).length;
    return {
      ...k,
      label: MONTH_NAMES[k.month - 1].toUpperCase(),
      score: mean(recorded.map((s) => s.score)),
      activeGoals: goalRepo.forMonth(k).length,
      consistency: elapsed ? activeDays / elapsed : 0,
      activeDays,
      elapsedDays: elapsed,
      totalDays: total,
      streakDays: streakCalc.compute(allScores, mvd, end < today() ? end : today()).currentStreak,
      isCurrent,
      isFuture,
      hasData: recorded.length > 0,
    };
  },

  /** Per-day score series for a month (for the month calendar). */
  monthDays(mk: MonthKey): HeatCell[] {
    const start = monthStart(mk.year, mk.month);
    const end = monthEnd(mk.year, mk.month);
    const byDate = new Map(scoreRepo.inRange(start, end).map((s) => [s.date, s]));
    return dateRange(start, end).map((date) => {
      const s = byDate.get(date);
      return { date, score: s?.score ?? 0, band: scoring.band(s?.score ?? 0), isFreeze: s?.isFreezeDay ?? false, inRange: date <= today() };
    });
  },

  // --- goal / area / process scoring -------------------------------------------

  /** 0..100 month-to-date execution of one goal against its active processes. */
  goalScore(goalId: string, mk: MonthKey): number {
    const procs = processRepo.forGoal(goalId, true);
    const range = elapsedRange(mk);
    if (!procs.length || !range) return 0;
    const execs = groupByDate(execRepo.forProcessesInRange(procs.map((p) => p.id), ...range));
    return mean(dateRange(...range).map((d) => scoring.goalDayScore(procs, execs.get(d) ?? [])));
  },

  areaScoresForMonth: (mk: MonthKey): NamedScore[] =>
    goalRepo.forMonth(mk).map((g) => {
      const area = areaRepo.byId(g.lifeAreaId);
      return { id: g.id, label: area?.name ?? 'Area', score: analytics.goalScore(g.id, mk), sub: g.title };
    }),

  processScoresForMonth(mk: MonthKey): NamedScore[] {
    const range = elapsedRange(mk);
    if (!range) return [];
    const days = dateRange(...range);
    const out: NamedScore[] = [];
    for (const g of goalRepo.forMonth(mk)) {
      const area = areaRepo.byId(g.lifeAreaId);
      for (const p of processRepo.forGoal(g.id, true)) out.push({ id: p.id, label: p.name, score: processMonthScore(p, days), sub: area?.name ?? '' });
    }
    return out;
  },

  // --- insights ----------------------------------------------------------

  insights(): InsightsView {
    const mvd = settings.mvd();
    const allScores = scoreRepo.all();
    const past = allScores.filter((s) => s.date <= today());
    const streak = streakCalc.compute(allScores, mvd);
    const cur = currentMonth();
    const scoreByProcess = analytics.processScoresForMonth(cur).sort((a, b) => b.score - a.score);
    const weekStart = weekStartOf(today());

    return {
      avgDaily: mean(past.map((s) => s.score)),
      weeklyAvg: mean(past.filter((s) => s.date >= weekStart).map((s) => s.score)),
      monthlyAvg: analytics.monthMeanScore(cur, allScores),
      ...processExecutionStats(),
      currentStreak: streak.currentStreak,
      longestStreak: Math.max(streak.longestStreak, streakRepo.get().longestStreak),
      activeDays: streak.activeDays,
      missedDays: streak.missedDays,
      freezeDaysUsed: streakRepo.get().freezeDaysUsed,
      scoreByArea: analytics.areaScoresForMonth(cur).sort((a, b) => b.score - a.score),
      scoreByMonth: analytics
        .monthTimeline()
        .flatMap((g) => g.months)
        .filter((m) => m.hasData)
        .slice(0, 12)
        .reverse()
        .map((m) => ({ label: `${m.label.slice(0, 3)} ${String(m.year).slice(2)}`, score: m.score })),
      scoreByProcess,
      strongestProcess: scoreByProcess[0] ?? null,
      weakestProcess: scoreByProcess.at(-1) ?? null,
      trend: past.slice(-45).map((s) => ({ date: s.date, score: s.score })),
      heatmap: analytics.heatmap(182),
    };
  },

  /**
   * Every calendar day from the first logged day (or `days` back) to today.
   * Days with no score row count as 0 — nothing was done — so gaps are honest
   * instead of silently disappearing. Today is in progress: it gets a column but
   * stays out of the averages.
   */
  scoreSeries(days: number | null): ScoreSeries {
    const end = today();
    const all = scoreRepo.all().filter((s) => s.date <= end);
    const empty: ScoreSeries = { points: [], avg: 0, prevAvg: null, securedDays: 0, completedDays: 0, best: null };
    if (!all.length) return empty;
    const first = all[0].date;
    const start = days ? (addDays(end, -(days - 1)) > first ? addDays(end, -(days - 1)) : first) : first;
    const byDate = new Map(all.map((s) => [s.date, s]));
    const mvd = settings.mvd();
    const scoreOn = (d: string) => byDate.get(d)?.score ?? 0;

    const points: ScorePoint[] = dateRange(start, end).map((date) => {
      const row = byDate.get(date);
      const isToday = date === end;
      let avg7: number | null = null;
      if (!isToday) {
        const win = dateRange(addDays(date, -6), date).filter((d) => d >= first);
        if (win.length >= 3) avg7 = Math.round(win.reduce((a, d) => a + scoreOn(d), 0) / win.length);
      }
      return { date, score: row?.score ?? 0, logged: !!row, isFreeze: row?.isFreezeDay ?? false, isToday, avg7 };
    });

    const done = points.filter((p) => !p.isToday);
    const meanOf = (ps: { score: number }[]) => (ps.length ? Math.round(ps.reduce((a, p) => a + p.score, 0) / ps.length) : 0);
    let prevAvg: number | null = null;
    if (days && done.length) {
      const prevEnd = addDays(done[0].date, -1);
      const prevStart = addDays(prevEnd, -(done.length - 1));
      if (prevEnd >= first) {
        const prev = dateRange(prevStart > first ? prevStart : first, prevEnd).map((d) => ({ score: scoreOn(d) }));
        prevAvg = meanOf(prev);
      }
    }
    return {
      points,
      avg: meanOf(done),
      prevAvg,
      securedDays: done.filter((p) => p.isFreeze || p.score >= mvd).length,
      completedDays: done.length,
      best: done.reduce<ScorePoint | null>((b, p) => (!b || p.score > b.score ? p : b), null),
    };
  },

  heatmap(days: number): HeatCell[] {
    const end = today();
    const start = addDays(end, -(days - 1));
    const byDate = new Map(scoreRepo.inRange(start, end).map((s) => [s.date, s]));
    return dateRange(weekStartOf(start), end).map((date) => {
      const s = byDate.get(date);
      return { date, score: s?.score ?? 0, band: scoring.band(s?.score ?? 0), isFreeze: s?.isFreezeDay ?? false, inRange: date >= start };
    });
  },

  monthMeanScore(mk: MonthKey, allScores = scoreRepo.all()): number {
    const start = monthStart(mk.year, mk.month);
    const end = monthEnd(mk.year, mk.month);
    return mean(allScores.filter((s) => s.date >= start && s.date <= end && s.date <= today()).map((s) => s.score));
  },

  // --- monthly review --------------------------------------------------

  monthlyReview(mk: MonthKey): MonthlyReviewView {
    const mvd = settings.mvd();
    const allScores = scoreRepo.all();
    const areaScores = analytics.areaScoresForMonth(mk).sort((a, b) => b.score - a.score);
    const processScores = analytics.processScoresForMonth(mk).sort((a, b) => b.score - a.score);
    const start = monthStart(mk.year, mk.month);
    const end = monthEnd(mk.year, mk.month);
    const rows = allScores.filter((s) => s.date >= start && s.date <= end && s.date <= today());

    const prevAreas = new Map(analytics.areaScoresForMonth(prevMonth(mk)).map((a) => [a.label, a.score]));
    let biggestDrop: NamedScore | null = null;
    for (const a of areaScores) {
      const before = prevAreas.get(a.label);
      if (before == null) continue;
      const delta = a.score - before;
      if (delta < 0 && (!biggestDrop || delta < biggestDrop.score)) biggestDrop = { label: a.label, score: delta, sub: `${before} → ${a.score}` };
    }

    return {
      ...mk,
      label: `${MONTH_NAMES[mk.month - 1]} ${mk.year}`,
      monthScore: analytics.monthMeanScore(mk, allScores),
      areaScores,
      bestProcess: processScores[0] ?? null,
      weakestProcess: processScores.at(-1) ?? null,
      mostConsistentArea: areaScores[0] ?? null,
      biggestDrop,
      streakDays: streakCalc.compute(allScores, mvd, end < today() ? end : today()).currentStreak,
      activeDays: rows.filter((s) => streakCalc.isActiveDay(s, mvd)).length,
      totalDays: daysInMonth(mk.year, mk.month),
    };
  },
};

function processMonthScore(p: Process, days: string[]): number {
  if (!days.length) return 0;
  const byDate = new Map(execRepo.forProcessesInRange([p.id], days[0], days[days.length - 1]).map((e) => [e.date, e]));
  return Math.round((days.reduce((s, d) => s + scoring.completionRatio(p, byDate.get(d)), 0) / days.length) * 100);
}

function processExecutionStats(): { processCompletionRate: number; processConsistency: number } {
  const start = addDays(today(), -29);
  const goalIds = goalRepo.distinctMonths().flatMap((mk) => goalRepo.forMonth(mk)).map((g) => g.id);
  const procs = processRepo.forGoals([...new Set(goalIds)], true);
  if (!procs.length) return { processCompletionRate: 0, processConsistency: 0 };
  const byProcess = new Map<string, DailyExecution[]>();
  for (const e of execRepo.forProcessesInRange(procs.map((p) => p.id), start, today())) {
    byProcess.set(e.processId, [...(byProcess.get(e.processId) ?? []), e]);
  }
  const per = procs.map((p) => {
    const list = byProcess.get(p.id) ?? [];
    const done = list.filter((e) => scoring.completionRatio(p, e) >= 0.999).length;
    return { rate: list.length ? done / list.length : 0, consistency: Math.min(1, list.length / 30) };
  });
  return {
    processCompletionRate: mean(per.map((x) => x.rate * 100)),
    processConsistency: mean(per.map((x) => x.consistency * 100)),
  };
}

// --- screen view-models ---------------------------------------------------

function processRow(p: Process, date: string, mk: MonthKey): ProcessExecutionRow {
  const todayExec = execRepo.forProcessAndDate(p.id, date);
  const history = execRepo.forProcess(p.id, 30);
  const done = history.filter((e) => scoring.completionRatio(p, e) >= 0.999).length;
  const range = elapsedRange(mk);
  return {
    process: p,
    today: todayExec,
    todayContribution: scoring.contribution(p, todayExec),
    history,
    completionRate: history.length ? done / history.length : 0,
    monthScore: range ? processMonthScore(p, dateRange(...range)) : 0,
  };
}

export const views = {
  goalNodes(mk: MonthKey): GoalNode[] {
    const dayExecs = execRepo.forDate(today());
    return goalRepo.forMonth(mk).map((goal) => {
      const procs = processRepo.forGoal(goal.id, true);
      return {
        goal,
        area: areaRepo.byId(goal.lifeAreaId)!,
        score: analytics.goalScore(goal.id, mk),
        processCount: procs.length,
        todayCompletion: scoring.goalDayScore(procs, dayExecs) / 100,
      };
    });
  },

  goalDetail(goalId: string): GoalDetailView | null {
    const goal = goalRepo.byId(goalId);
    if (!goal) return null;
    const mk = { year: goal.year, month: goal.month };
    const procs = processRepo.forGoal(goalId, false);
    return {
      goal,
      area: areaRepo.byId(goal.lifeAreaId)!,
      monthScore: analytics.goalScore(goalId, mk),
      rows: procs.map((p) => processRow(p, today(), mk)),
      weightTotal: procs.filter((p) => p.active).reduce((s, p) => s + p.weight, 0),
    };
  },

  todayView(date = today()): TodayView {
    const goals = goalRepo.forMonth(monthOf(date));
    const dayScore = scoreRepo.forDate(date);
    const dayExecs = execRepo.forDate(date);
    const mvd = settings.mvd();
    const inputs = goals.map((g) => ({ processes: processRepo.forGoal(g.id, true), executions: dayExecs, weight: g.weight }));
    const groups: TodayAreaGroup[] = goals.map((goal, i) => ({
      area: areaRepo.byId(goal.lifeAreaId)!,
      goal,
      rows: inputs[i].processes.map((p) => processRow(p, date, monthOf(date))),
      areaScore: scoring.goalDayScore(inputs[i].processes, dayExecs),
    }));
    // Fixed priority: biggest share of the month first — the order never shifts during the day.
    groups.sort((a, b) => b.goal.weight - a.goal.weight || a.goal.title.localeCompare(b.goal.title));
    const score = dayScore?.score ?? scoring.dailyScore(inputs);
    return {
      date,
      score,
      groups,
      isFreezeDay: dayScore?.isFreezeDay ?? false,
      isMinimumViableDay: score >= mvd,
      minimumViableDay: mvd,
      hasGoals: groups.some((g) => g.rows.length > 0),
    };
  },
};
