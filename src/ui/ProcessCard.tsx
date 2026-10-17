import { useRef, useState } from 'react';
import { Check, ExternalLink, Minus, NotebookPen, Plus, Target } from 'lucide-react';
import type { ProcessExecutionRow } from '../core/models';
import { scoring } from '../core/scoring';
import { execution } from '../core/services';
import { popAt } from './fx';

/**
 * One controllable behaviour, as a big tappable card.
 * Binary → tap anywhere to complete. Quantitative → stepper toward the target.
 *
 * The element that owns the click is never transformed (no scale/translate on
 * press or hover): if it moved under the pointer between pointerdown and
 * pointerup, the browser would drop the click and the card would need two taps.
 * The press feedback lives on the inner `.pcard-body` instead.
 */
export function ProcessCard({ row, date, color }: { row: ProcessExecutionRow; date: string; color: string }) {
  const { process: p, today: exec } = row;
  const ref = useRef<HTMLDivElement>(null);
  const quant = scoring.isQuantitative(p);
  const ratio = scoring.completionRatio(p, exec);
  const done = ratio >= 0.999;
  const actual = exec?.actualValue ?? (exec?.completed ? p.targetValue : 0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(exec?.note ?? '');

  const toggle = () => {
    if (!done) popAt(ref.current, color);
    execution.toggleProcess(p.id, date);
  };

  const setValue = (v: number) => {
    const next = Math.max(0, Math.round(v * 100) / 100);
    if (next >= p.targetValue && actual < p.targetValue) popAt(ref.current, color);
    execution.setActualValue(p.id, date, next);
  };
  const step = p.targetValue >= 20 ? Math.round(p.targetValue / 10) : 1;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={ref}
      className={`pcard ${done ? 'done' : ''} ${quant ? 'quant' : 'binary'}`}
      style={{ ['--c' as string]: color }}
      onClick={quant ? undefined : toggle}
      role={quant ? undefined : 'button'}
      tabIndex={quant ? undefined : 0}
      aria-pressed={quant ? undefined : done}
      onKeyDown={quant ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
    >
      <div className="pcard-fill" style={{ width: `${ratio * 100}%` }} />
      <div className="pcard-body">
        <div className="pcard-top">
          <span className={`check ${done ? 'on' : ''}`} aria-hidden>
            {done && <Check size={16} strokeWidth={3.5} />}
          </span>
          <div className="pcard-text">
            <span className="pcard-name">{p.name}</span>
            {p.description && <span className="pcard-desc">{p.description}</span>}
          </div>
          <span className="pts" title="Points toward this goal">
            {row.todayContribution > 0 ? `+${row.todayContribution}` : p.weight}
            <small>/{p.weight}</small>
          </span>
        </div>

        {quant && (
          <div className="stepper">
            <button type="button" className="step-btn" aria-label="Decrease" disabled={actual <= 0} onClick={() => setValue(actual - step)}>
              <Minus size={16} strokeWidth={3} />
            </button>
            <label className="step-val">
              <input type="number" min={0} value={actual} onChange={(e) => setValue(Number(e.target.value))} aria-label={`${p.name} amount`} />
              <span>/ {p.targetValue} {p.unit}</span>
            </label>
            <button type="button" className="step-btn" aria-label="Increase" onClick={() => setValue(actual + step)}>
              <Plus size={16} strokeWidth={3} />
            </button>
            <button type="button" className="step-btn max" disabled={done} onClick={() => setValue(p.targetValue)} title="Hit the target">
              <Target size={16} />
            </button>
          </div>
        )}

        <div className="pcard-tools" onClick={stop}>
          <span className="pcard-rate" title="Completion over the last recorded days">{Math.round(row.completionRate * 100)}% hit rate</span>
          {p.link && (
            <a className="tool" href={p.link} target="_blank" rel="noreferrer" title="Open tool" aria-label="Open tool">
              <ExternalLink size={15} />
            </a>
          )}
          <button type="button" className={`tool ${exec?.note ? 'has' : ''}`} onClick={() => setNoteOpen((o) => !o)} title="Note" aria-label="Note">
            <NotebookPen size={15} />
          </button>
        </div>
        {noteOpen && (
          <textarea
            className="input note"
            autoFocus
            placeholder="A quick note about today…"
            value={note}
            onClick={stop}
            onKeyDown={stop}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => execution.setNote(p.id, date, note)}
          />
        )}
      </div>
    </div>
  );
}
