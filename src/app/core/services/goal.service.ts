import { Injectable, inject } from '@angular/core';
import { LifeArea, MonthKey, MonthlyGoal, Process } from '../models';
import { DailyExecutionRepository } from '../repositories/daily-execution.repository';
import { LifeAreaRepository } from '../repositories/life-area.repository';
import { MonthlyGoalRepository } from '../repositories/monthly-goal.repository';
import { ProcessDraft, ProcessRepository } from '../repositories/process.repository';
import { addDays, monthOf, today } from '../util/date';
import { ExecutionService } from './execution.service';
import { StateBus } from './state-bus.service';

export interface ProcessSpec {
  id?: string;
  name: string;
  description: string;
  weight: number;
  targetValue: number;
  unit: string;
}

export interface WeightCheck {
  total: number;
  valid: boolean;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private areas = inject(LifeAreaRepository);
  private goals = inject(MonthlyGoalRepository);
  private processes = inject(ProcessRepository);
  private execs = inject(DailyExecutionRepository);
  private execution = inject(ExecutionService);
  private bus = inject(StateBus);

  checkWeights(specs: { weight: number }[]): WeightCheck {
    const total = specs.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
    return { total, valid: total === 100 && specs.length > 0 };
  }

  areasList(): LifeArea[] {
    return this.areas.all();
  }

  /** Sum of every goal's weight in a month (optionally excluding one goal). */
  monthWeightTotal(month: MonthKey, excludeGoalId?: string): number {
    return this.goals
      .forMonth(month)
      .filter((g) => g.id !== excludeGoalId)
      .reduce((sum, g) => sum + (g.weight || 0), 0);
  }

  /** Set the weight allocation for a month's goals, then re-score its days. */
  setGoalWeights(month: MonthKey, entries: { id: string; weight: number }[]): void {
    for (const e of entries) {
      this.goals.update(e.id, { weight: Math.max(0, Math.round(Number(e.weight) || 0)) });
    }
    this.recalcRecentDays(month);
    this.bus.bump();
  }

  createArea(name: string, description = '', icon = ''): LifeArea {
    const area = this.areas.create({ name, description, icon });
    this.bus.bump();
    return area;
  }

  /**
   * Create a monthly goal with its processes. Process weights must total exactly
   * 100; the goal's own weight (its share of the month) must not push the month
   * over 100.
   */
  createGoal(input: {
    lifeAreaId: string;
    month: MonthKey;
    title: string;
    description: string;
    weight: number;
    processes: ProcessSpec[];
  }): MonthlyGoal {
    if (!this.checkWeights(input.processes).valid) {
      throw new Error('Process weights must total exactly 100.');
    }
    const weight = Math.max(0, Math.round(Number(input.weight) || 0));
    if (this.monthWeightTotal(input.month) + weight > 100) {
      throw new Error('This goal would push the month past 100. Lower its weight first.');
    }
    const goal = this.goals.create({
      lifeAreaId: input.lifeAreaId,
      year: input.month.year,
      month: input.month.month,
      title: input.title.trim(),
      description: input.description.trim(),
      weight,
      isDemo: false,
    });
    input.processes.forEach((spec, i) =>
      this.processes.create(specToDraft(goal.id, spec, i)),
    );
    this.recalcRecentDays(input.month);
    this.bus.bump();
    return goal;
  }

  updateGoal(
    goalId: string,
    patch: { title?: string; description?: string; weight?: number },
  ): void {
    this.goals.update(goalId, patch);
    const goal = this.goals.byId(goalId);
    if (goal) this.recalcRecentDays({ year: goal.year, month: goal.month });
    this.bus.bump();
  }

  deleteGoal(goalId: string): void {
    const goal = this.goals.byId(goalId);
    this.goals.delete(goalId);
    if (goal) this.recalcRecentDays({ year: goal.year, month: goal.month });
    this.bus.bump();
  }

  updateProcess(processId: string, patch: Partial<Process>): void {
    this.processes.update(processId, patch);
    const p = this.processes.byId(processId);
    if (p) this.recalcRecentDays({ year: 0, month: 0 }, p.monthlyGoalId);
    this.bus.bump();
  }

  addProcess(goalId: string, spec: ProcessSpec): Process {
    const count = this.processes.forGoal(goalId).length;
    const created = this.processes.create(specToDraft(goalId, spec, count));
    this.bus.bump();
    return created;
  }

  removeProcess(processId: string): void {
    this.processes.delete(processId);
    this.bus.bump();
  }

  /** Replace the whole process set for a goal (used by the goal editor). */
  replaceProcesses(goalId: string, specs: ProcessSpec[]): void {
    if (!this.checkWeights(specs).valid) {
      throw new Error('Process weights must total exactly 100.');
    }
    const existing = this.processes.forGoal(goalId);
    const keepIds = new Set(specs.filter((s) => s.id).map((s) => s.id));
    for (const p of existing) if (!keepIds.has(p.id)) this.processes.delete(p.id);
    specs.forEach((spec, i) => {
      if (spec.id) {
        this.processes.update(spec.id, {
          name: spec.name,
          description: spec.description,
          weight: spec.weight,
          targetValue: spec.targetValue,
          unit: spec.unit,
          position: i,
        });
      } else {
        this.processes.create(specToDraft(goalId, spec, i));
      }
    });
    const goal = this.goals.byId(goalId);
    if (goal) this.recalcRecentDays({ year: goal.year, month: goal.month });
    this.bus.bump();
  }

  private recalcRecentDays(month: MonthKey, goalId?: string): void {
    let start = today();
    let end = today();
    if (goalId) {
      const goal = this.goals.byId(goalId);
      if (goal) month = { year: goal.year, month: goal.month };
    }
    if (month.year) {
      const cur = monthOf(today());
      start = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
      end = month.year === cur.year && month.month === cur.month ? today() : addDays(start, 27);
    }
    for (let d = start; d <= end; d = addDays(d, 1)) this.execution.recalcDay(d);
  }
}

function specToDraft(goalId: string, spec: ProcessSpec, position: number): ProcessDraft {
  return {
    monthlyGoalId: goalId,
    name: spec.name.trim(),
    description: spec.description.trim(),
    weight: Math.round(Number(spec.weight) || 0),
    targetValue: Math.max(1, Number(spec.targetValue) || 1),
    unit: spec.unit.trim(),
    position,
    active: true,
  };
}
