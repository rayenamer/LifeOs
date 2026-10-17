import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Map, Plus, Snowflake, Undo2 } from 'lucide-react';
import { useDb } from '../core/store';
import { views } from '../core/analytics';
import { consistency } from '../core/services';
import { streakRepo } from '../core/repos';
import { addDays, MONTH_NAMES, parseIso, today, WEEKDAY_NAMES } from '../core/date';
import { scoring } from '../core/scoring';
import { BandChip, Empty, Ring, StreakFlame, useToast } from '../ui/components';
import { ProcessCard } from '../ui/ProcessCard';
import { AreaBadge, areaColor } from '../ui/areas';
import { celebrate, fireworks } from '../ui/fx';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Today() {
  const [date, setDate] = useState(today());
  const isToday = date === today();
  const view = useDb(() => views.todayView(date), [date]);
  const streak = useDb(() => streakRepo.get());
  const canFreeze = useDb(() => consistency.canFreeze(date), [date]);
  const toast = useToast();

  // Celebrate threshold crossings — only for changes made while looking at this day.
  const prev = useRef<{ date: string; score: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (p && p.date === date) {
      if (p.score < 100 && view.score >= 100) {
        fireworks();
        toast('Perfect day — 100 / 100');
      } else if (p.score < view.minimumViableDay && view.score >= view.minimumViableDay) {
        celebrate();
        toast('Day secured — the streak continues');
      }
    }
    prev.current = { date, score: view.score };
  }, [date, view.score, view.minimumViableDay, toast]);

  const d = parseIso(date);
  const toGo = Math.max(0, view.minimumViableDay - view.score);
  const doneCount = view.groups.reduce((s, g) => s + g.rows.filter((r) => scoring.completionRatio(r.process, r.today) >= 0.999).length, 0);
  const totalCount = view.groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <div className="page today">
      <header className="today-head">
        <div>
          <p className="eyebrow">{isToday ? greeting() : 'Editing a past day'}</p>
          <h1>
            {WEEKDAY_NAMES[d.getDay()]}, {d.getDate()} {MONTH_NAMES[d.getMonth()]}
          </h1>
          <div className="day-nav">
            <button className="btn small ghost icon-only" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft size={18} />
            </button>
            {!isToday && <button className="btn small ghost" onClick={() => setDate(today())}>Back to today</button>}
            <button className="btn small ghost icon-only" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <StreakFlame days={streak.currentStreak} size="lg" />
      </header>

      <section className="hero card">
        <Ring value={view.score} size={170} stroke={16} marker={view.minimumViableDay}>
          <motion.span key={view.score} className="hero-score" initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
            {view.score}
          </motion.span>
          <span className="hero-of">/ 100</span>
        </Ring>
        <div className="hero-info">
          <BandChip score={view.score} />
          <h2>
            {view.isFreezeDay
              ? 'Freeze day — streak protected'
              : view.isMinimumViableDay
                ? view.score >= 100
                  ? 'A perfect day.'
                  : 'Day secured. Keep stacking points.'
                : view.hasGoals
                  ? `${toGo} points to secure the day`
                  : 'No processes this month yet'}
          </h2>
          <p className="muted">
            {view.hasGoals
              ? `${doneCount} of ${totalCount} processes done · minimum viable day is ${view.minimumViableDay} pts`
              : 'Create a monthly goal to get daily processes here.'}
          </p>
          <div className="row gap wrap">
            {canFreeze && view.hasGoals && !view.isMinimumViableDay && (
              <button
                className="btn freeze"
                onClick={() => consistency.useFreezeDay(date) && toast('Freeze day used', 'info')}
                title="Protects your streak without pretending you did the work"
              >
                <Snowflake size={16} /> Use a freeze ({streak.freezeDaysAvailable} left)
              </button>
            )}
            {view.isFreezeDay && (
              <button className="btn ghost small" onClick={() => consistency.removeFreezeDay(date)}>
                <Undo2 size={15} /> Undo freeze
              </button>
            )}
          </div>
        </div>
      </section>

      {!view.hasGoals ? (
        <Empty icon={Map} title="Nothing on the board yet">
          <p className="muted">Goals are the direction; processes are what you control every day.</p>
          <Link className="btn primary" to="/goals/new"><Plus size={16} /> Create a goal</Link>
        </Empty>
      ) : (
        view.groups.map((g, gi) => {
          const color = areaColor(g.area);
          return (
            <motion.section
              key={g.goal.id}
              className="quest-group"
              style={{ ['--c' as string]: color }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
            >
              <Link className="quest-head" to={`/months/${g.goal.year}/${g.goal.month}/goal/${g.goal.id}`}>
                <AreaBadge area={g.area} />
                <div className="quest-title">
                  <small>{g.area.name}{g.goal.weight ? ` · ${g.goal.weight}% of the month` : ''}</small>
                  <b>{g.goal.title}</b>
                </div>
                <Ring value={g.areaScore} size={48} stroke={6} color={color}>
                  <small className="mini-num">{g.areaScore}</small>
                </Ring>
              </Link>
              <div className="pgrid">
                {g.rows.map((r) => (
                  <ProcessCard key={r.process.id + date} row={r} date={date} color={color} />
                ))}
              </div>
            </motion.section>
          );
        })
      )}
    </div>
  );
}
