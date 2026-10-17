import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDb } from '../core/store';
import { goals, sumWeights, weightsValid } from '../core/services';
import type { MonthKey } from '../core/models';
import { currentMonth, MONTH_NAMES } from '../core/date';
import { ArrowLeft, ArrowRight, Check, Hash, Plus, Rocket, SquareCheck } from 'lucide-react';
import { evenSplit, useToast, WeightEditor } from '../ui/components';
import { ProcessEditor, PSpec, blankSpec } from '../ui/ProcessEditor';
import { AreaBadge, areaColor, AREA_COLORS, IconPicker } from '../ui/areas';
import { fireworks } from '../ui/fx';

const STEPS = ['Life area', 'Month', 'The goal', 'Processes', 'Weights', 'Review'];

const label = (m: MonthKey) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

export function GoalWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search] = useSearchParams();
  const areas = useDb(() => goals.areas());

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [areaId, setAreaId] = useState('');
  const [newArea, setNewArea] = useState(areas.length === 0);
  const [areaName, setAreaName] = useState('');
  const [areaDesc, setAreaDesc] = useState('');
  const [areaIcon, setAreaIcon] = useState('target');
  const [month, setMonth] = useState<MonthKey>(
    search.get('y') ? { year: Number(search.get('y')), month: Number(search.get('m')) } : currentMonth(),
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [specs, setSpecs] = useState<PSpec[]>([blankSpec(100)]);
  const [error, setError] = useState('');

  const monthOptions = useMemo(() => {
    const out: MonthKey[] = [];
    const c = currentMonth();
    for (let i = -1; i <= 3; i++) {
      const d = new Date(c.year, c.month - 1 + i, 1);
      out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return out;
  }, []);

  const monthTotal = useDb(() => goals.monthWeightTotal(month), [month.year, month.month]);
  const left = Math.max(0, 100 - monthTotal);
  const weight = goalWeight ?? left;
  const areaTaken = useDb(() => (areaId ? goals.hasGoalFor(areaId, month) : false), [areaId, month.year, month.month]);
  const validSpecs = specs.filter((s) => s.name.trim());
  const selectedArea = areas.find((a) => a.id === areaId);
  const previewArea = newArea ? { name: areaName || 'New area', icon: areaIcon, position: areas.length } : selectedArea;
  const color = previewArea ? areaColor(previewArea) : AREA_COLORS[0];

  const canNext = [
    newArea ? areaName.trim().length > 0 : !!areaId,
    !areaTaken,
    title.trim().length > 0 && weight <= left,
    validSpecs.length > 0,
    weightsValid(validSpecs),
    true,
  ][step];

  const go = (delta: number) => {
    setError('');
    if (delta > 0 && step === 3) {
      // drop blank rows; seed an even split if the weights don't add up yet
      const cleaned = specs.filter((s) => s.name.trim());
      if (sumWeights(cleaned) !== 100) {
        const split = evenSplit(cleaned.length);
        setSpecs(cleaned.map((s, i) => ({ ...s, weight: split[i] })));
      } else setSpecs(cleaned);
    }
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  };

  const create = () => {
    try {
      const lifeAreaId = newArea ? goals.createArea(areaName.trim(), areaDesc.trim(), areaIcon).id : areaId;
      const goal = goals.createGoal({ lifeAreaId, month, title, description, weight, processes: validSpecs });
      fireworks();
      toast('Goal created — its processes are on Today');
      navigate(`/months/${goal.year}/${goal.month}/goal/${goal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page wizard">
      <Link to="/" className="back"><ArrowLeft size={15} /> Cancel</Link>
      <header className="page-head">
        <p className="eyebrow">New monthly goal</p>
        <h1>{STEPS[step]}</h1>
        <div className="steps">
          {STEPS.map((s, i) => (
            <motion.span key={s} className={`step-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} animate={{ scale: i === step ? 1.1 : 1 }} title={s}>
              {i < step ? <Check size={15} strokeWidth={3} /> : i + 1}
            </motion.span>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.section
          key={step}
          className="card wizard-body"
          custom={dir}
          initial={{ opacity: 0, x: dir * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -40 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <>
              <p className="q">Which part of your life is this about?</p>
              <div className="pick-grid">
                {areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`pick ${areaId === a.id && !newArea ? 'sel' : ''}`}
                    style={{ ['--c' as string]: areaColor(a) }}
                    onClick={() => { setAreaId(a.id); setNewArea(false); }}
                  >
                    <AreaBadge area={a} size="sm" />
                    <b>{a.name}</b>
                    {a.description && <small>{a.description}</small>}
                  </button>
                ))}
                <button type="button" className={`pick new ${newArea ? 'sel' : ''}`} onClick={() => { setNewArea(true); setAreaId(''); }}>
                  <span className="pick-plus"><Plus size={18} /></span>
                  <b>New life area</b>
                </button>
              </div>
              {newArea && (
                <div className="stack">
                  <input className="input" autoFocus placeholder="Name, e.g. Health" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
                  <input className="input" placeholder="Description (optional)" value={areaDesc} onChange={(e) => setAreaDesc(e.target.value)} />
                  <IconPicker value={areaIcon} onPick={setAreaIcon} color={color} />
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <p className="q">Which month are you planning?</p>
              <div className="pick-grid">
                {monthOptions.map((m) => {
                  const total = goals.monthWeightTotal(m);
                  return (
                    <button key={`${m.year}-${m.month}`} type="button" className={`pick ${m.year === month.year && m.month === month.month ? 'sel' : ''}`} onClick={() => { setMonth(m); setGoalWeight(null); }}>
                      <b>{label(m)}</b>
                      <small>{total}/100 allocated</small>
                    </button>
                  );
                })}
              </div>
              {areaTaken && <p className="error">This area already has a goal in {label(month)}. One goal per area per month — pick another month or area.</p>}
            </>
          )}

          {step === 2 && (
            <div className="stack">
              <p className="q">Name the direction — an outcome you can influence, but not fully control.</p>
              <input className="input big" autoFocus placeholder="e.g. Build momentum toward a new role" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input" placeholder="Why it matters (optional) — future you will thank you during reviews." value={description} onChange={(e) => setDescription(e.target.value)} />
              <label className="field">
                <span>Share of {label(month)} — <b>{weight}</b> pts <small className="muted">({monthTotal} already taken, {left} left)</small></span>
                <input type="range" min={0} max={left} value={Math.min(weight, left)} onChange={(e) => setGoalWeight(Number(e.target.value))} style={{ accentColor: color }} />
              </label>
              {left === 0 && <p className="warn">This month is fully allocated. You can still add the goal at 0 and rebalance from the month view.</p>}
            </div>
          )}

          {step === 3 && (
            <>
              <p className="q">The daily processes: small, controllable behaviours. Binary (done / not done) or an amount toward a target.</p>
              <ProcessEditor specs={specs} onChange={setSpecs} />
            </>
          )}

          {step === 4 && (
            <>
              <p className="q">How many of the goal's 100 points does each process carry?</p>
              <WeightEditor
                items={specs.map((s) => ({ key: s.key, label: s.name, weight: s.weight, color }))}
                onChange={(w) => setSpecs(specs.map((s, i) => ({ ...s, weight: w[i] })))}
              />
            </>
          )}

          {step === 5 && (
            <div className="launch">
              <AreaBadge area={previewArea} size="xl" />
              <small className="muted">{previewArea?.name} · {label(month)} · {weight}% of the month</small>
              <h2>{title}</h2>
              {description && <p className="muted">{description}</p>}
              <ul className="launch-list">
                {validSpecs.map((s) => (
                  <li key={s.key}>
                    <span className="with-icon">{Number(s.targetValue) > 1 ? <Hash size={15} /> : <SquareCheck size={15} />} {s.name}{Number(s.targetValue) > 1 ? ` — ${s.targetValue} ${s.unit}` : ''}</span>
                    <b>{s.weight} pts</b>
                  </li>
                ))}
              </ul>
              {error && <p className="error">{error}</p>}
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <div className="row between wizard-nav">
        <button className="btn ghost" disabled={step === 0} onClick={() => go(-1)}><ArrowLeft size={16} /> Back</button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" disabled={!canNext} onClick={() => go(1)}>Next <ArrowRight size={16} /></button>
        ) : (
          <button className="btn primary big" onClick={create}><Rocket size={17} /> Create goal</button>
        )}
      </div>
    </div>
  );
}
