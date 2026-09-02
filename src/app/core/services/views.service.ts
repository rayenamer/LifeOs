import { Injectable, inject } from '@angular/core';
import {
  GoalDetailView,
  GoalNode,
  MonthKey,
  Process,
  ProcessExecutionRow,
  TodayAreaGroup,
  TodayView,
} from '../models';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import { LifeAreaRepository } from '../repositories/life-area.repository';
import { MonthlyGoalRepository } from '../repositories/monthly-goal.repository';
import { ProcessRepository } from '../repositories/process.repository';
import { monthOf, today } from '../util/date';
import { AnalyticsService } from './analytics.service';
import { ScoringService } from './scoring.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class ViewsService {
  private areas = inject(LifeAreaRepository);
  private goals = inject(MonthlyGoalRepository);
  private processes = inject(ProcessRepository);
  private execs = inject(DailyExecutionRepository);
  private scores = inject(DailyScoreRepository);
  private scoring = inject(ScoringService);
  private analytics = inject(AnalyticsService);
  private settings = inject(SettingsService);

  // --- month detail constellation --------------------------------------

  goalNodes(mk: MonthKey): GoalNode[] {
    const date = today();
    const dayExecs = this.execs.forDate(date);
    return this.goals.forMonth(mk).map((goal) => {
      const area = this.areas.byId(goal.lifeAreaId)!;
      const procs = this.processes.forGoal(goal.id, true);
      const todayScore = this.scoring.goalDayScore(procs, dayExecs);
      return {
        goal,
        area,
        score: this.analytics.goalScore(goal.id, mk),
        processCount: procs.length,
        todayCompletion: todayScore / 100,
      };
    });
  }

  // --- goal detail -----------------------------------------------------

  goalDetail(goalId: string): GoalDetailView | null {
    const goal = this.goals.byId(goalId);
    if (!goal) return null;
    const area = this.areas.byId(goal.lifeAreaId)!;
    const mk: MonthKey = { year: goal.year, month: goal.month };
    const procs = this.processes.forGoal(goalId, false);
    const rows = procs.map((p) => this.processRow(p, today(), mk));
    return {
      goal,
      area,
      monthScore: this.analytics.goalScore(goalId, mk),
      rows,
      weightTotal: procs.filter((p) => p.active).reduce((s, p) => s + p.weight, 0),
    };
  }

  // --- today ---------------------------------------------------------

  todayView(date = today()): TodayView {
    const mk = monthOf(date);
    const goals = this.goals.forMonth(mk);
    const dayScore = this.scores.forDate(date);
    const mvd = this.settings.minimumViableDay();

    const groups: TodayAreaGroup[] = goals.map((goal) => {
      const area = this.areas.byId(goal.lifeAreaId)!;
      const procs = this.processes.forGoal(goal.id, true);
      const rows = procs.map((p) => this.processRow(p, date, mk));
      return {
        area,
        goal,
        rows,
        areaScore: this.scoring.goalDayScore(procs, this.execs.forDate(date)),
      };
    });

    const score = dayScore?.score ?? this.scoring.dailyScore(
      groups.map((g) => ({
        processes: this.processes.forGoal(g.goal.id, true),
        executions: this.execs.forDate(date),
        weight: g.goal.weight,
      })),
    );

    return {
      date,
      score,
      groups,
      isFreezeDay: dayScore?.isFreezeDay ?? false,
      isMinimumViableDay: score >= mvd,
      minimumViableDay: mvd,
      hasGoals: groups.some((g) => g.rows.length > 0),
    };
  }

  private processRow(process: Process, date: string, mk: MonthKey): ProcessExecutionRow {
    const todayExec = this.execs.forProcessAndDate(process.id, date);
    const history = this.execs.forProcess(process.id, 30);
    const recorded = history.length;
    const done = history.filter((e) => this.scoring.completionRatio(process, e) >= 0.999).length;
    return {
      process,
      today: todayExec,
      todayContribution: this.scoring.contribution(process, todayExec),
      history,
      completionRate: recorded ? done / recorded : 0,
      monthScore: this.processMonthScore(process, mk),
    };
  }

  private processMonthScore(process: Process, mk: MonthKey): number {
    const scores = this.analytics.processScoresForMonth(mk);
    const match = scores.find((s) => s.label === process.name);
    return match?.score ?? 0;
  }
}
