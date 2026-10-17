import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDb } from '../core/store';
import { weeks } from '../core/services';
import type { ActionItemStatus } from '../core/models';
import { shortDate, weekEndOf, isoWeekNumber } from '../core/date';
import { ArrowLeft, Check, CircleDashed, CornerDownRight, ListTodo, Plus, RotateCcw, Save, Sparkles, Wrench, X, CloudRain } from 'lucide-react';
import { Ring, useToast } from '../ui/components';
import { celebrate } from '../ui/fx';

export function Reflections() {
  const list = useDb(() => weeks.recent(12));
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Weekly ritual</p>
        <h1>Reflect</h1>
        <p className="muted">Ten minutes a week: what worked, what didn't, what you'll change. This is where the system gets better.</p>
      </header>
      <div className="week-list">
        {list.map((w, i) => (
          <motion.div key={w.weekStart} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            <Link to={`/reflection/${w.weekStart}`} className={`week-row card ${w.isCurrent ? 'current' : ''}`}>
              <Ring value={w.avgScore} size={54} stroke={7}><b className="mini-num">{w.avgScore}</b></Ring>
              <div className="grow">
                <b>Week {w.weekNumber}{w.isCurrent ? ' · this week' : ''}</b>
                <small className="muted">{shortDate(w.weekStart)} → {shortDate(w.weekEnd)}</small>
              </div>
              <span className={`status ${w.completed ? 'ok' : ''}`}>{w.completed ? <><Check size={13} strokeWidth={3} /> Reflected</> : 'To do'}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const STATUS_CYCLE: ActionItemStatus[] = ['open', 'done', 'carried'];
const STATUS_LABEL: Record<ActionItemStatus, React.ReactNode> = {
  open: <><CircleDashed size={14} /> Open</>,
  done: <><Check size={14} strokeWidth={3} /> Done</>,
  carried: <><CornerDownRight size={14} /> Carried</>,
};

interface ItemDraft { key: string; text: string; status: ActionItemStatus }

export function Reflection() {
  const { weekStart = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useDb(() => weeks.get(weekStart), [weekStart]);
  const previous = useDb(() => weeks.previousActionItems(weekStart), [weekStart]);
  const ref = useDb(() => weeks.describe(weekStart), [weekStart]);

  const [well, setWell] = useState(existing?.whatWentWell ?? '');
  const [notWell, setNotWell] = useState(existing?.whatDidntGoWell ?? '');
  const [change, setChange] = useState(existing?.whatToChange ?? '');
  const [reviewed, setReviewed] = useState(existing?.previousActionItemsReviewed ?? false);
  const [items, setItems] = useState<ItemDraft[]>(
    existing?.actionItems.length
      ? existing.actionItems.map((i) => ({ key: i.id, text: i.text, status: i.status }))
      : [{ key: 'new0', text: '', status: 'open' }],
  );

  const valid = [well, notWell, change].some((s) => s.trim());

  const save = () => {
    weeks.save(weekStart, {
      whatWentWell: well,
      whatDidntGoWell: notWell,
      whatToChange: change,
      previousActionItemsReviewed: reviewed,
      actionItems: items,
    });
    celebrate();
    toast('Reflection saved');
    navigate('/reflection');
  };

  const prompts = [
    { icon: Sparkles, tone: '#22b07d', title: 'What went well?', value: well, set: setWell, hint: 'Wins, even tiny ones. What made them possible?' },
    { icon: CloudRain, tone: '#f2668b', title: "What didn't go well?", value: notWell, set: setNotWell, hint: 'No blame — just friction you noticed.' },
    { icon: Wrench, tone: '#6d5efc', title: 'What will you change?', value: change, set: setChange, hint: 'One adjustment to the system, not to your willpower.' },
  ];

  return (
    <div className="page">
      <Link to="/reflection" className="back"><ArrowLeft size={15} /> All weeks</Link>
      <header className="page-head">
        <p className="eyebrow">Week {isoWeekNumber(weekStart)} · {shortDate(weekStart)} → {shortDate(weekEndOf(weekStart))}</p>
        <h1>Weekly reflection</h1>
        <p className="muted">Average score this week: <b>{ref.avgScore}</b></p>
      </header>

      {previous.length > 0 && (
        <section className="card">
          <h3 className="with-icon"><RotateCcw size={17} /> Last week's action items</h3>
          <ul className="items">
            {previous.map((it) => (
              <li key={it.id} className={`item ${it.status}`}>
                <span className="grow">{it.text}</span>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => weeks.setItemStatus(it.id, STATUS_CYCLE[(STATUS_CYCLE.indexOf(it.status) + 1) % 3])}
                >
                  {STATUS_LABEL[it.status]}
                </button>
              </li>
            ))}
          </ul>
          <label className="check-row">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> I reviewed last week's items
          </label>
        </section>
      )}

      <div className="prompt-grid">
        {prompts.map((p) => (
          <section key={p.title} className="card prompt">
            <h3 className="with-icon"><span className="prompt-icon" style={{ color: p.tone, background: `color-mix(in srgb, ${p.tone} 14%, transparent)` }}><p.icon size={17} /></span> {p.title}</h3>
            <textarea className="input tall" placeholder={p.hint} value={p.value} onChange={(e) => p.set(e.target.value)} />
          </section>
        ))}
      </div>

      <section className="card">
        <h3 className="with-icon"><ListTodo size={17} /> Action items for next week</h3>
        <ul className="items">
          {items.map((it, i) => (
            <li key={it.key} className="item">
              <input
                className="input grow"
                placeholder="A concrete next step"
                value={it.text}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
              <button type="button" className="btn small ghost" onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(x.status) + 1) % 3] } : x)))}>
                {STATUS_LABEL[it.status]}
              </button>
              <button type="button" className="btn icon danger" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn ghost add" onClick={() => setItems([...items, { key: 'new' + Date.now(), text: '', status: 'open' }])}><Plus size={15} /> Add item</button>
      </section>

      <div className="row end">
        <button className="btn primary big" disabled={!valid} onClick={save}><Save size={17} /> Save reflection</button>
      </div>
    </div>
  );
}
