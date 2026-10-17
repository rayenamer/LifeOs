/**
 * LifeOS persisted entities.
 * Column values are stored snake_case in SQLite; repositories map to/from these camelCase shapes.
 */

export interface LifeArea {
  id: string;
  name: string;
  description: string;
  icon: string;
  position: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  lifeAreaId: string;
  year: number;
  month: number; // 1..12
  title: string;
  description: string;
  weight: number; // 0..100 — share of the month; all goals of one month sum to 100
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A controllable behaviour that moves the user toward a monthly goal. */
export interface Process {
  id: string;
  monthlyGoalId: string;
  name: string;
  description: string;
  link: string; // optional URL to an external tool for this process ('' when unset)
  weight: number; // 0..100, all active processes of one goal sum to 100
  targetValue: number; // 1 => binary process; >1 => quantitative
  unit: string;
  position: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Execution of a single process on a single day. Stored independently from the definition. */
export interface DailyExecution {
  id: string;
  processId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  actualValue: number | null;
  score: number; // contribution points earned (0..process.weight)
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyScore {
  id: string;
  date: string; // YYYY-MM-DD
  score: number; // 0..100
  isMinimumViableDay: boolean;
  isFreezeDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeDaysUsed: number;
  freezeDaysAvailable: number;
  updatedAt: string;
}

export type ActionItemStatus = 'open' | 'done' | 'carried';

export interface ActionItem {
  id: string;
  reflectionId: string;
  text: string;
  status: ActionItemStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReflection {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  whatWentWell: string;
  whatDidntGoWell: string;
  whatToChange: string;
  previousActionItemsReviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReflectionWithItems extends WeeklyReflection {
  actionItems: ActionItem[];
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface AppSettings {
  accent: string;
  theme: ThemeMode; // new-app only; the Angular app ignores unknown setting keys
  minimumViableDay: number; // points threshold for a valid consistency day
  freezeDaysAvailable: number;
  seeded: boolean;
}

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
  id?: string;
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

/** One calendar day on the daily-score chart. */
export interface ScorePoint {
  date: string;
  score: number; // 0 when the day has no score row (nothing logged)
  logged: boolean; // a daily_score row exists
  isFreeze: boolean;
  isToday: boolean; // still in progress
  avg7: number | null; // trailing 7-day mean of completed days; null for today / not enough history
}

export interface ScoreSeries {
  points: ScorePoint[];
  avg: number; // mean over completed days in range
  prevAvg: number | null; // same-length period just before, for the delta
  securedDays: number; // completed days that met the minimum viable day (or were frozen)
  completedDays: number;
  best: ScorePoint | null;
}
