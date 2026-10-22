import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../core/store';
import { views } from '../core/analytics';
import { goals, weightsValid } from '../core/services';
import { scoring } from '../core/scoring';
import { addDays, monthOf, MONTH_NAMES, sameMonth, shortDate, today } from '../core/date';
import { ArrowLeft, CalendarCheck, Hash, Pencil, SearchX, Target, Trash2 } from 'lucide-react';
import { usePrivate } from '../core/privacy';
import { Confirm, Empty, Pv, Ring, useToast, WeightEditor } from '../ui/components';
import { ProcessCard } from '../ui/ProcessCard';
import { ProcessEditor, PSpec } from '../ui/ProcessEditor';
import { AreaBadge, areaColor, areaIconName, IconPicker } from '../ui/areas';

export function GoalDetail() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const view = useDb(() => views.goalDetail(goalId), [goalId]);
  const hidden = usePrivate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [specs, setSpecs] = useState<PSpec[]>([]);
  const [error, setError] = useState('');

  if (!view) {
    return (
      <div className="page">
        <Empty icon={SearchX} title="That goal doesn't exist anymore">
          <Link className="btn primary" to="/months">Back to months</Link>
        </Empty>
      </div>
    );
  }

  const { goal, area } = view;
  const color = areaColor(area);
  const isCurrentMonth = sameMonth(monthOf(today()), goal);
  const back = `/months/${goal.year}/${goal.month}`;

  const startEdit = () => {
    setTitle(goal.title);
    setDescription(goal.description);
    setIcon(areaIconName(area));
    setSpecs(view.rows.map((r) => ({ key: r.process.id, ...r.process })));
    setError('');
    setEditing(true);
  };

  const save = () => {
    try {
      const clean = specs.filter((s) => s.name.trim());
      goals.replaceProcesses(goal.id, clean);
      goals.updateGoal(goal.id, { title: title.trim() || goal.title, description: description.trim() });
      if (icon !== areaIconName(area)) goals.updateArea(area.id, { icon });
      setEditing(false);
      toast('Goal updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // last 30 days, oldest → newest, for the history strip
  const strip = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29));

  return (
    <div className="page">
      <Link to={back} className="back"><ArrowLeft size={15} /> {MONTH_NAMES[goal.month - 1]} {goal.year}</Link>
      <header className="goal-hero card" style={{ ['--c' as string]: color }}>
        <AreaBadge area={area} size="xl" />
        <div className="grow">
          <p className="eyebrow"><Pv>{area.name}</Pv> · {goal.weight}% of the month</p>
          <h1><Pv>{goal.title}</Pv></h1>
          {goal.description && <p className="muted"><Pv>{goal.description}</Pv></p>}
          <div className="row gap wrap">
            {!editing && <button className="btn ghost small" onClick={startEdit}><Pencil size={14} /> Edit</button>}
            <button className="btn ghost small danger-text" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
        <Ring value={view.monthScore} size={110} stroke={12} color={color}>
          <b className="hero-score small">{view.monthScore}</b>
          <small className="muted">month</small>
        </Ring>
      </header>

      {editing ? (
        <section className="card stack">
          <h3>Edit goal</h3>
          <input className="input big" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" placeholder="Why it matters" value={description} onChange={(e) => setDescription(e.target.value)} />
          <details>
            <summary>Area icon for “<Pv>{area.name}</Pv>”</summary>
            <IconPicker value={icon} onPick={setIcon} color={color} />
          </details>
          <h3>Processes</h3>
          <ProcessEditor specs={specs} onChange={setSpecs} />
          <h3>Weights</h3>
          <WeightEditor
            items={specs.map((s) => ({ key: s.key, label: s.name, weight: s.weight, color }))}
            onChange={(w) => setSpecs(specs.map((s, i) => ({ ...s, weight: w[i] })))}
          />
          {error && <p className="error">{error}</p>}
          <div className="row end gap">
            <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn primary" disabled={!weightsValid(specs.filter((s) => s.name.trim()))} onClick={save}>Save changes</button>
          </div>
        </section>
      ) : (
        <>
          {isCurrentMonth && (
            <section>
              <h3 className="section-title">Today</h3>
              <div className="pgrid">
                {view.rows.filter((r) => r.process.active).map((r) => (
                  <ProcessCard key={r.process.id} row={r} date={today()} color={color} />
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h3>Process stats</h3>
            <div className="pstats">
              {view.rows.map((r) => {
                const byDate = new Map(r.history.map((e) => [e.date, e]));
                return (
                  <div key={r.process.id} className="pstat">
                    <div className="row between center-y">
                      <b><Pv>{r.process.name}</Pv></b>
                      <span className="chip">{r.process.weight} pts</span>
                    </div>
                    <div className="row gap muted small-text">
                      <span className="with-icon"><CalendarCheck size={13} /> month {r.monthScore}%</span>
                      <span className="with-icon"><Target size={13} /> hit rate {Math.round(r.completionRate * 100)}%</span>
                      {scoring.isQuantitative(r.process) && <span className="with-icon"><Hash size={13} /> target {r.process.targetValue} {r.process.unit}</span>}
                    </div>
                    <div className="strip" aria-label="Last 30 days">
                      {strip.map((d) => {
                        const ratio = scoring.completionRatio(r.process, byDate.get(d));
                        return (
                          <span
                            key={d}
                            title={`${shortDate(d)} · ${Math.round(ratio * 100)}%${byDate.get(d)?.note && !hidden ? ' · note: ' + byDate.get(d)!.note : ''}`}
                            style={{ background: ratio > 0 ? color : undefined, opacity: ratio > 0 ? 0.25 + ratio * 0.75 : 1 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <Confirm
        open={confirmDelete}
        danger
        title="Delete this goal?"
        message={<p>“<Pv>{goal.title}</Pv>”, its processes and all their check-ins will be removed. Daily scores for the month are recalculated.</p>}
        confirmLabel="Delete forever"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          goals.deleteGoal(goal.id);
          toast('Goal deleted', 'info');
          navigate(back);
        }}
      />
    </div>
  );
}
