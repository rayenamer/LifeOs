import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDb } from '../core/store';
import { analytics } from '../core/analytics';
import { Flame, Target } from 'lucide-react';
import { Ring } from '../ui/components';

export function Months() {
  const years = useDb(() => analytics.monthTimeline());
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Your journey</p>
        <h1>Months</h1>
        <p className="muted">Every month is a season. Tap one to see its goals, calendar and review.</p>
      </header>
      {years.map((y) => (
        <section key={y.year} className="year">
          <h2 className="year-title">{y.year}</h2>
          <div className="month-grid">
            {y.months.map((m, i) => (
              <motion.div key={m.month} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                <Link
                  to={`/months/${m.year}/${m.month}`}
                  className={`month-tile card ${m.isCurrent ? 'current' : ''} ${m.isFuture ? 'future' : ''} ${!m.hasData && !m.isFuture ? 'quiet' : ''}`}
                >
                  {m.isCurrent && <span className="now-badge">NOW</span>}
                  {m.isFuture && <span className="now-badge plan">PLANNED</span>}
                  <Ring value={m.score} size={74} stroke={9}>
                    <b className="mini-num">{m.hasData ? m.score : '–'}</b>
                  </Ring>
                  <div className="month-info">
                    <b>{m.label.charAt(0) + m.label.slice(1).toLowerCase()}</b>
                    <small className="with-icon"><Target size={13} /> {m.activeGoals} goal{m.activeGoals === 1 ? '' : 's'}</small>
                    {!m.isFuture && (
                      <>
                        <span className="consistency" title="Active days / elapsed days">
                          <span style={{ width: `${Math.round(m.consistency * 100)}%` }} />
                        </span>
                        <small className="with-icon">{m.activeDays}/{m.elapsedDays} active · <Flame size={13} /> {m.streakDays}</small>
                      </>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
