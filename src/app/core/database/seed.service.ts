import { Injectable, inject } from '@angular/core';
import { Process } from '../models';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { DailyScoreRepository } from '../repositories/daily-score.repository';
import { LifeAreaRepository } from '../repositories/life-area.repository';
import { MonthlyGoalRepository } from '../repositories/monthly-goal.repository';
import { ProcessRepository } from '../repositories/process.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { WeeklyReflectionRepository } from '../repositories/weekly-reflection.repository';
import { ConsistencyService } from '../services/consistency.service';
import { ScoringService } from '../services/scoring.service';
import { addDays, dateRange, monthOf, parseIso, today, weekStartOf } from '../util/date';
import { SqliteService } from './sqlite.service';

interface ProcTemplate {
  name: string;
  description: string;
  weight: number;
  targetValue: number;
  unit: string;
  reliability: number; // 0..1 baseline completion propensity
}

interface AreaTemplate {
  name: string;
  description: string;
  icon: string;
  goalTitle: string;
  goalDescription: string;
  /** This goal's share of the month. The four templates sum to 100. */
  goalWeight: number;
  processes: ProcTemplate[];
}

const TEMPLATES: AreaTemplate[] = [
  {
    name: 'Career',
    description: 'Direction of professional work and opportunity.',
    icon: 'career',
    goalTitle: 'Build momentum toward a finance / risk engineering career',
    goalDescription: 'The outcome is uncertain — the search is the process.',
    goalWeight: 30,
    processes: [
      { name: 'Apply to relevant positions', description: 'Targeted, tailored applications only.', weight: 35, targetValue: 3, unit: 'applications', reliability: 0.72 },
      { name: 'Contact recruiters', description: 'Direct, specific outreach.', weight: 25, targetValue: 2, unit: 'contacts', reliability: 0.66 },
      { name: 'Improve CV / portfolio', description: 'One concrete improvement.', weight: 15, targetValue: 1, unit: '', reliability: 0.55 },
      { name: 'Research target companies', description: 'Understand the field before applying.', weight: 15, targetValue: 2, unit: 'companies', reliability: 0.7 },
      { name: 'Networking outreach', description: 'Start or continue one conversation.', weight: 10, targetValue: 1, unit: '', reliability: 0.48 },
    ],
  },
  {
    name: 'Finance',
    description: 'Personal financial discipline and skill.',
    icon: 'finance',
    goalTitle: 'Build stronger financial modeling discipline',
    goalDescription: 'Competence compounds. Practice the reps.',
    goalWeight: 25,
    processes: [
      { name: 'Financial modeling practice', description: 'Deliberate practice, not passive reading.', weight: 35, targetValue: 45, unit: 'minutes', reliability: 0.68 },
      { name: 'Track every expense', description: 'Log the day fully.', weight: 20, targetValue: 1, unit: '', reliability: 0.85 },
      { name: 'Review budget vs actual', description: 'Compare plan to reality.', weight: 15, targetValue: 1, unit: '', reliability: 0.6 },
      { name: 'Markets / macro brief', description: 'Read one substantive brief.', weight: 15, targetValue: 1, unit: '', reliability: 0.74 },
      { name: 'Investing research note', description: 'Write a short thesis note.', weight: 15, targetValue: 1, unit: '', reliability: 0.52 },
    ],
  },
  {
    name: 'Health',
    description: 'Physical baseline and energy.',
    icon: 'health',
    goalTitle: 'Establish a sustainable training routine',
    goalDescription: 'Consistency over intensity.',
    goalWeight: 25,
    processes: [
      { name: 'Train / workout', description: 'Any deliberate session counts.', weight: 30, targetValue: 1, unit: '', reliability: 0.7 },
      { name: 'Walk 8,000 steps', description: 'Move through the day.', weight: 25, targetValue: 8000, unit: 'steps', reliability: 0.8 },
      { name: 'Sleep 7h+', description: 'Protect the window.', weight: 20, targetValue: 1, unit: '', reliability: 0.66 },
      { name: 'Mobility / stretch', description: 'Short and regular.', weight: 15, targetValue: 10, unit: 'minutes', reliability: 0.58 },
      { name: 'No late screens', description: 'Screens off before bed.', weight: 10, targetValue: 1, unit: '', reliability: 0.5 },
    ],
  },
  {
    name: 'Learning',
    description: 'Quantitative and technical depth.',
    icon: 'learning',
    goalTitle: 'Develop quantitative and technical depth',
    goalDescription: 'Understanding is built one block at a time.',
    goalWeight: 20,
    processes: [
      { name: 'Deep work block', description: 'One uninterrupted focused block.', weight: 35, targetValue: 60, unit: 'minutes', reliability: 0.7 },
      { name: 'Solve practice problems', description: 'Active problem solving.', weight: 25, targetValue: 3, unit: 'problems', reliability: 0.64 },
      { name: 'Read technical material', description: 'Read with intent.', weight: 20, targetValue: 20, unit: 'pages', reliability: 0.72 },
      { name: 'Write notes / summary', description: 'Explain it back.', weight: 10, targetValue: 1, unit: '', reliability: 0.55 },
      { name: 'Spaced repetition review', description: 'Clear the queue.', weight: 10, targetValue: 1, unit: '', reliability: 0.6 },
    ],
  },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addMonths(mk: { year: number; month: number }, delta: number) {
  const total = mk.year * 12 + (mk.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * Realistic demo data so LifeOS looks complete on first launch.
 * Everything created here is flagged is_demo = 1 and can be wiped from Settings.
 */
@Injectable({ providedIn: 'root' })
export class SeedService {
  private db = inject(SqliteService);
  private areas = inject(LifeAreaRepository);
  private goals = inject(MonthlyGoalRepository);
  private processes = inject(ProcessRepository);
  private execs = inject(DailyExecutionRepository);
  private scores = inject(DailyScoreRepository);
  private reflections = inject(WeeklyReflectionRepository);
  private settingsRepo = inject(SettingsRepository);
  private scoring = inject(ScoringService);
  private consistency = inject(ConsistencyService);

  ensureSeeded(): void {
    if (this.settingsRepo.get('seeded') === '1') return;
    this.build();
    this.settingsRepo.set('seeded', '1');
  }

  private build(): void {
    const cur = monthOf(today());
    const months = [addMonths(cur, -2), addMonths(cur, -1), cur];
    const start = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`;
    const end = today();
    const rng = mulberry32(20260901);

    const missedDays = new Set([addDays(end, -19), addDays(end, -12), addDays(end, -4)]);
    const freezeDay = addDays(end, -12);

    this.db.transaction(() => {
      // areas + goals + processes
      for (const tpl of TEMPLATES) {
        const area = this.areas.create({
          name: tpl.name,
          description: tpl.description,
          icon: tpl.icon,
          isDemo: true,
        });
        for (const mk of months) {
          const goal = this.goals.create({
            lifeAreaId: area.id,
            year: mk.year,
            month: mk.month,
            title: tpl.goalTitle,
            description: tpl.goalDescription,
            weight: tpl.goalWeight,
            isDemo: true,
          });
          tpl.processes.forEach((p, i) =>
            this.processes.create({
              monthlyGoalId: goal.id,
              name: p.name,
              description: p.description,
              weight: p.weight,
              targetValue: p.targetValue,
              unit: p.unit,
              position: i,
              active: true,
            }),
          );
        }
      }

      // day-by-day execution history
      for (const date of dateRange(start, end)) {
        const mk = monthOf(date);
        const monthGoals = this.goals.forMonth(mk);
        const dow = parseIso(date).getDay();
        const weekendDrag = dow === 0 || dow === 6 ? -0.12 : 0;
        const wave = 0.1 * Math.sin(parseIso(date).getTime() / 8.64e7 / 2.2);
        const isToday = date === end;
        const missed = missedDays.has(date);
        const dayFactor = missed
          ? 0
          : Math.max(0.1, Math.min(1.05, 0.82 + weekendDrag + wave + (rng() - 0.5) * 0.22));

        if (!missed) {
          for (const goal of monthGoals) {
            for (const process of this.processes.forGoal(goal.id, true)) {
              const rel = reliabilityFor(process.name);
              const drive = dayFactor * (0.5 + rel * 0.62) + (rng() - 0.5) * 0.16;
              const ratio = Math.max(0, Math.min(1.05, drive));
              const quantitative = process.targetValue > 1;

              if (isToday && rng() > 0.5) continue; // leave today partly open

              let completed = false;
              let actualValue: number | null = null;
              if (quantitative) {
                actualValue = Math.round(process.targetValue * Math.min(1.05, ratio) * (isToday ? 0.85 : 1));
                if (actualValue <= 0) continue;
                completed = actualValue >= process.targetValue;
              } else {
                completed = ratio > 0.62;
                if (!completed && rng() > 0.3) continue;
              }
              const score = this.scoring.contribution(process, execStub(process, date, completed, actualValue));
              this.execs.upsert(process.id, date, { completed, actualValue, score });
            }
          }
        }

        const dayExecs = this.execs.forDate(date);
        const dayScore = this.scoring.dailyScore(
          monthGoals.map((g) => ({
            processes: this.processes.forGoal(g.id, true),
            executions: dayExecs,
            weight: g.weight,
          })),
        );
        this.scores.upsert(date, {
          score: dayScore,
          isMinimumViableDay: dayScore >= 30,
          isFreezeDay: date === freezeDay,
        });
      }

      // one completed reflection for the previous week
      this.reflections.save(addDays(weekStartOf(end), -7), {
        whatWentWell:
          'Applications went out consistently early in the week and the modeling practice held up. Morning deep-work blocks were the anchor of every good day.',
        whatDidntGoWell:
          'Networking outreach slipped again — it keeps losing to lower-value tasks. Two late nights hurt the following mornings.',
        whatToChange:
          'Move networking to a fixed 15-minute slot right after the first deep-work block, before email.',
        previousActionItemsReviewed: true,
        actionItems: [
          { text: 'Book the networking slot in the calendar for every weekday', status: 'open' },
          { text: 'Prepare 3 recruiter messages in advance on Sunday', status: 'open' },
          { text: 'Lights-out by 23:30 on training days', status: 'carried' },
        ],
      });

      const freezeUsed = date_countFreeze(this.scores);
      this.db.run(
        `UPDATE streak SET freeze_days_available = ?, freeze_days_used = ?, updated_at = datetime('now') WHERE id = 1`,
        [Math.max(0, 2 - freezeUsed), freezeUsed],
      );
    });

    this.consistency.recompute();
    this.consistency.refresh();
  }
}

function reliabilityFor(name: string): number {
  for (const tpl of TEMPLATES) {
    const match = tpl.processes.find((p) => p.name === name);
    if (match) return match.reliability;
  }
  return 0.6;
}

function execStub(process: Process, date: string, completed: boolean, actualValue: number | null) {
  return {
    id: '',
    processId: process.id,
    date,
    completed,
    actualValue,
    score: 0,
    note: '',
    createdAt: '',
    updatedAt: '',
  };
}

function date_countFreeze(scores: DailyScoreRepository): number {
  return scores.all().filter((s) => s.isFreezeDay).length;
}
