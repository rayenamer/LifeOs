import { useDb } from '../core/store';
import { analytics } from '../core/analytics';
import { settings } from '../core/services';
import { Activity, CalendarDays, CalendarRange, CheckCircle2, Flame, Gauge, Repeat, Snowflake, TrendingDown, TrendingUp } from 'lucide-react';
import { Bars, Heatmap, Stat } from '../ui/components';
import { ScoreChart } from '../ui/ScoreChart';

export function Insights() {
  const v = useDb(() => analytics.insights());
  const mvd = useDb(() => settings.mvd());
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">The feedback loop</p>
        <h1>Insights</h1>
        <p className="muted">Data, not judgement. Look for patterns, then tweak the system.</p>
      </header>

      <div className="stat-grid">
        <Stat icon={Flame} tone="#ef7d3c" label="Current streak" value={v.currentStreak} sub={`best ${v.longestStreak}`} />
        <Stat icon={Gauge} tone="var(--accent)" label="Avg daily score" value={v.avgDaily} />
        <Stat icon={CalendarDays} tone="#3aa7e8" label="This week" value={v.weeklyAvg} />
        <Stat icon={CalendarRange} tone="#d65db1" label="This month" value={v.monthlyAvg} />
        <Stat icon={CheckCircle2} tone="#22b07d" label="Completion rate" value={`${v.processCompletionRate}%`} sub="last 30 days" />
        <Stat icon={Repeat} tone="#f0a030" label="Consistency" value={`${v.processConsistency}%`} sub="days engaged" />
        <Stat icon={Activity} tone="#6d5efc" label="Active days" value={v.activeDays} sub={`${v.missedDays} missed`} />
        <Stat icon={Snowflake} tone="#3aa7e8" label="Freezes used" value={v.freezeDaysUsed} />
      </div>

      <ScoreChart mvd={mvd} />

      <section className="card">
        <h3>Six months of showing up</h3>
        <Heatmap cells={v.heatmap} />
      </section>

      <div className="two-col">
        <section className="card">
          <h3>Areas this month</h3>
          <Bars items={v.scoreByArea} empty="No goals this month" />
        </section>
        <section className="card">
          <h3>Month by month</h3>
          <Bars items={v.scoreByMonth} empty="No history yet" />
        </section>
      </div>

      <section className="card">
        <h3>Process leaderboard</h3>
        {v.strongestProcess && v.weakestProcess && v.scoreByProcess.length > 1 && (
          <div className="row gap wrap callouts">
            <span className="callout good"><TrendingUp size={16} /> Strongest: <b>{v.strongestProcess.label}</b> ({v.strongestProcess.score}%)</span>
            <span className="callout weak"><TrendingDown size={16} /> Weakest: <b>{v.weakestProcess.label}</b> ({v.weakestProcess.score}%)</span>
          </div>
        )}
        <Bars items={v.scoreByProcess} ranked empty="No processes this month" />
      </section>
    </div>
  );
}
