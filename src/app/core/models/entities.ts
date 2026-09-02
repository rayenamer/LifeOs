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

export interface AppSettings {
  accent: string;
  minimumViableDay: number; // points threshold for a valid consistency day
  freezeDaysAvailable: number;
  seeded: boolean;
}
