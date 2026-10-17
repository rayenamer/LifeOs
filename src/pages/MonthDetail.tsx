import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDb } from '../core/store';
import { analytics, views } from '../core/analytics';
import { goals } from '../core/services';
import { MONTH_NAMES, parseIso, shortDate, today } from '../core/date';
import { ArrowLeft, Gift, Plus, Scale, Sprout } from 'lucide-react';
import { Empty, Modal, Ring, useToast, WeightEditor } from '../ui/components';
import { AreaBadge, areaColor, bandColor } from '../ui/areas';

export function MonthDetail() {
  const params = useParams();
  const mk = { year: Number(params.year), month: Number(params.month) };
  const nodes = useDb(() => views.goalNodes(mk), [mk.year, mk.month]);
  const days = useDb(() => analytics.monthDays(mk), [mk.year, mk.month]);
  const score = useDb(() => analytics.monthMeanScore(mk), [mk.year, mk.month]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const toast = useToast();

  const weightTotal = nodes.reduce((s, n) => s + n.goal.weight, 0);
  const lead = (parseIso(days[0].date).getDay() + 6) % 7; // Monday-first calendar

  const openRebalance = () => {
    setDraft(nodes.map((n) => n.goal.weight));
    setEditing(true);
  };
  const save = () => {
    goals.setGoalWeights(mk, nodes.map((n, i) => ({ id: n.goal.id, weight: draft[i] })));
    setEditing(false);
    toast('Month rebalanced');
  };

  return (
    <div className="page">
      <Link to="/months" className="back"><ArrowLeft size={15} /> All months</Link>
      <header className="month-hero card">
        <Ring value={score} size={110} stroke={12}>
          <b className="hero-score small">{score}</b>
        </Ring>
        <div>
          <p className="eyebrow">{mk.year}</p>
          <h1>{MONTH_NAMES[mk.month - 1]}</h1>
          <p className="muted">
            {nodes.length} goal{nodes.length === 1 ? '' : 's'} · {weightTotal}/100 of the month allocated
          </p>
          <div className="row gap wrap">
            <Link className="btn primary small" to={`/goals/new?y=${mk.year}&m=${mk.month}`}><Plus size={15} /> Add goal</Link>
            {nodes.length > 1 && <button className="btn ghost small" onClick={openRebalance}><Scale size={15} /> Rebalance</button>}
            <Link className="btn ghost small" to={`/review/${mk.year}/${mk.month}`}><Gift size={15} /> Month wrapped</Link>
          </div>
        </div>
      </header>

      <section className="card">
        <h3>Calendar</h3>
        <div className="cal">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
          {days.map((c) => (
            <span
              key={c.date}
              className={`cal-day ${c.inRange ? '' : 'future'} ${c.date === today() ? 'is-today' : ''}`}
              style={{ background: c.isFreeze ? 'var(--freeze)' : c.inRange && c.score > 0 ? bandColor(c.band) : undefined }}
              title={`${shortDate(c.date)} · ${c.isFreeze ? 'freeze day' : c.score}`}
            >
              {parseIso(c.date).getDate()}
            </span>
          ))}
        </div>
      </section>

      {!nodes.length ? (
        <Empty icon={Sprout} title="No goals this month">
          <Link className="btn primary" to={`/goals/new?y=${mk.year}&m=${mk.month}`}>Plant one</Link>
        </Empty>
      ) : (
        <div className="goal-grid">
          {nodes.map((n, i) => {
            const color = areaColor(n.area);
            return (
              <motion.div key={n.goal.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/months/${mk.year}/${mk.month}/goal/${n.goal.id}`} className="goal-card card" style={{ ['--c' as string]: color }}>
                  <AreaBadge area={n.area} size="lg" />
                  <small className="muted">{n.area.name}</small>
                  <h3>{n.goal.title}</h3>
                  <div className="row between">
                    <span className="chip">{n.goal.weight}% of month</span>
                    <span className="chip">{n.processCount} processes</span>
                  </div>
                  <div className="row between center-y">
                    <Ring value={n.score} size={64} stroke={8} color={color}><b className="mini-num">{n.score}</b></Ring>
                    <div className="today-meter">
                      <small>Today</small>
                      <span className="consistency"><span style={{ width: `${Math.round(n.todayCompletion * 100)}%`, background: color }} /></span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Rebalance the month">
        <p className="muted">How much of this month does each goal deserve? Goals sum to 100, just like processes inside a goal.</p>
        <WeightEditor
          items={nodes.map((n, i) => ({ key: n.goal.id, label: n.goal.title, weight: draft[i] ?? 0, color: areaColor(n.area) }))}
          onChange={setDraft}
        />
        <div className="row end gap">
          <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn primary" disabled={draft.reduce((a, b) => a + b, 0) !== 100} onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}
