import { DailyExecution, Process } from '../models';
import { ScoringService } from './scoring.service';

function process(over: Partial<Process>): Process {
  return {
    id: over.id ?? 'p',
    monthlyGoalId: 'g',
    name: 'p',
    description: '',
    weight: 10,
    targetValue: 1,
    unit: '',
    position: 0,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function exec(over: Partial<DailyExecution>): DailyExecution {
  return {
    id: 'e',
    processId: over.processId ?? 'p',
    date: '2026-09-01',
    completed: false,
    actualValue: null,
    score: 0,
    note: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

describe('ScoringService', () => {
  const svc = new ScoringService();

  it('gives a binary process full weight when completed, zero otherwise', () => {
    const p = process({ weight: 35 });
    expect(svc.contribution(p, exec({ completed: true }))).toBe(35);
    expect(svc.contribution(p, exec({ completed: false }))).toBe(0);
    expect(svc.contribution(p, null)).toBe(0);
  });

  it('scales a quantitative process by actual / target', () => {
    const p = process({ weight: 20, targetValue: 20 });
    expect(svc.contribution(p, exec({ actualValue: 17 }))).toBe(17);
    expect(svc.contribution(p, exec({ actualValue: 40 }))).toBe(20); // clamped
    expect(svc.contribution(p, exec({ completed: true }))).toBe(20); // completed => full
  });

  it('sums process contributions into a 0..100 goal score', () => {
    const processes = [
      process({ id: 'a', weight: 35 }),
      process({ id: 'b', weight: 25 }),
      process({ id: 'c', weight: 20 }),
      process({ id: 'd', weight: 10 }),
      process({ id: 'e', weight: 10 }),
    ];
    const executions = [
      exec({ processId: 'a', completed: true }),
      exec({ processId: 'b', completed: true }),
      exec({ processId: 'c', completed: true }),
      exec({ processId: 'e', completed: true }),
    ];
    expect(svc.goalDayScore(processes, executions)).toBe(90);
  });

  it('averages goal scores equally when no goal carries a weight', () => {
    const g1 = {
      processes: [process({ id: 'a', weight: 100 })],
      executions: [exec({ processId: 'a', completed: true })],
    };
    const g2 = {
      processes: [process({ id: 'b', weight: 100 })],
      executions: [exec({ processId: 'b', completed: false })],
    };
    expect(svc.dailyScore([g1, g2])).toBe(50);
  });

  it('weights goal scores by each goal share of the month', () => {
    const strong = {
      weight: 70,
      processes: [process({ id: 'a', weight: 100 })],
      executions: [exec({ processId: 'a', completed: true })], // goal score 100
    };
    const weak = {
      weight: 30,
      processes: [process({ id: 'b', weight: 100 })],
      executions: [exec({ processId: 'b', completed: false })], // goal score 0
    };
    // 100*0.7 + 0*0.3 = 70  (not the equal-weight 50)
    expect(svc.dailyScore([strong, weak])).toBe(70);
  });

  it('normalises when month weights do not sum to 100', () => {
    const a = {
      weight: 20,
      processes: [process({ id: 'a', weight: 100 })],
      executions: [exec({ processId: 'a', completed: true })], // 100
    };
    const b = {
      weight: 20,
      processes: [process({ id: 'b', weight: 100 })],
      executions: [exec({ processId: 'b', completed: false })], // 0
    };
    // total weight 40 -> (100*20 + 0*20) / 40 = 50
    expect(svc.dailyScore([a, b])).toBe(50);
  });

  it('ignores goals with no active processes', () => {
    const g1 = {
      processes: [process({ id: 'a', weight: 100 })],
      executions: [exec({ processId: 'a', completed: true })],
    };
    const empty = { processes: [], executions: [] };
    expect(svc.dailyScore([g1, empty])).toBe(100);
  });
});
