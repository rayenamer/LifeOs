import { DailyExecution, LifeArea, MonthlyGoal, Process } from './entities';

/** Progress qualitative band, derived from a 0..100 score. */
export type ScoreBand = 'void' | 'low' | 'mid' | 'good' | 'high';

export interface MonthKey {
  year: number;
  month: number; // 1..12
}

/** One row in the Months timeline. */
export interface MonthSummary extends MonthKey {
  label: string; // "SEPTEMBER"
  score: number; // 0..100 mean daily score across elapsed days
  activeGoals: number;
  consistency: number; // 0..1 active days / elapsed days
  activeDays: number;
  elapsedDays: number;
  totalDays: number;
  streakDays: number; // current streak as of the last day of the month
  isCurrent: boolean;
  isFuture: boolean;
  hasData: boolean;
}

export interface YearGroup {
  year: number;
  months: MonthSummary[];
}

/** A life-area goal node in the month-detail constellation. */
export interface GoalNode {
  goal: MonthlyGoal;
  area: LifeArea;
  score: number; // 0..100 month-to-date execution against this goal's processes
  processCount: number;
  todayCompletion: number; // 0..1 share of today's weight executed
}

export interface ProcessExecutionRow {
  process: Process;
  today: DailyExecution | null;
  todayContribution: number; // points earned today (0..weight)
  history: DailyExecution[]; // recent executions, newest first
  completionRate: number; // 0..1 over recorded days
  monthScore: number; // 0..100 mean contribution ratio this month
}

export interface GoalDetailView {
  goal: MonthlyGoal;
  area: LifeArea;
  monthScore: number;
  rows: ProcessExecutionRow[];
  weightTotal: number;
}

/** A single life-area block inside the Today screen. */
export interface TodayAreaGroup {
  area: LifeArea;
  goal: MonthlyGoal;
  rows: ProcessExecutionRow[];
  areaScore: number; // 0..100 — this goal's own execution today
}

export interface TodayView {
  date: string;
  score: number;
  groups: TodayAreaGroup[];
  isFreezeDay: boolean;
  isMinimumViableDay: boolean;
  minimumViableDay: number;
  hasGoals: boolean;
}

export interface HeatCell {
  date: string;
  score: number;
  band: ScoreBand;
  isFreeze: boolean;
  inRange: boolean;
}

export interface TrendPoint {
  date: string;
  score: number;
}

export interface NamedScore {
  label: string;
  score: number;
  sub?: string;
}

export interface InsightsView {
  avgDaily: number;
  weeklyAvg: number;
  monthlyAvg: number;
  processCompletionRate: number;
  processConsistency: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  missedDays: number;
  freezeDaysUsed: number;
  scoreByArea: NamedScore[];
  scoreByMonth: NamedScore[];
  scoreByProcess: NamedScore[];
  strongestProcess: NamedScore | null;
  weakestProcess: NamedScore | null;
  trend: TrendPoint[];
  heatmap: HeatCell[];
}

export interface MonthlyReviewView extends MonthKey {
  label: string;
  monthScore: number;
  areaScores: NamedScore[];
  bestProcess: NamedScore | null;
  weakestProcess: NamedScore | null;
  mostConsistentArea: NamedScore | null;
  biggestDrop: NamedScore | null;
  streakDays: number;
  activeDays: number;
  totalDays: number;
}
