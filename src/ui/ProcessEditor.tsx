import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Plus, SquareCheck, X } from 'lucide-react';
import type { ProcessSpec } from '../core/services';
import { uid } from '../core/id';

export interface PSpec extends ProcessSpec {
  key: string;
}

export const blankSpec = (weight = 0): PSpec => ({ key: uid(), name: '', description: '', link: '', weight, targetValue: 1, unit: '' });

/** Edit the definitions of a goal's processes (name, binary vs. quantitative target, link). */
export function ProcessEditor({ specs, onChange }: { specs: PSpec[]; onChange: (s: PSpec[]) => void }) {
  const patch = (i: number, p: Partial<PSpec>) => onChange(specs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="pedit">
      <AnimatePresence initial={false}>
        {specs.map((s, i) => {
          const quant = Number(s.targetValue) > 1;
          return (
            <motion.div key={s.key} className="pedit-row card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="row gap">
                <span className="pedit-num">{i + 1}</span>
                <input className="input grow" placeholder="What will you do? e.g. Deep work block" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} />
                <button type="button" className="btn icon danger" aria-label="Remove process" onClick={() => onChange(specs.filter((_, j) => j !== i))}><X size={16} /></button>
              </div>
              <input className="input" placeholder="Details (optional)" value={s.description} onChange={(e) => patch(i, { description: e.target.value })} />
              <div className="row gap wrap center-y">
                <div className="seg">
                  <button type="button" className={!quant ? 'on' : ''} onClick={() => patch(i, { targetValue: 1, unit: '' })}><SquareCheck size={14} /> Done / not done</button>
                  <button type="button" className={quant ? 'on' : ''} onClick={() => patch(i, { targetValue: quant ? s.targetValue : 10 })}><Hash size={14} /> Amount</button>
                </div>
                {quant && (
                  <>
                    <label className="inline">
                      Target
                      <input className="input tiny" type="number" min={2} value={s.targetValue} onChange={(e) => patch(i, { targetValue: Number(e.target.value) })} />
                    </label>
                    <input className="input tiny wide" placeholder="unit (min, pages…)" value={s.unit} onChange={(e) => patch(i, { unit: e.target.value })} />
                  </>
                )}
              </div>
              <input className="input" placeholder="Link to a tool (optional) — https://…" value={s.link} onChange={(e) => patch(i, { link: e.target.value })} />
            </motion.div>
          );
        })}
      </AnimatePresence>
      <button type="button" className="btn ghost add" onClick={() => onChange([...specs, blankSpec()])}><Plus size={15} /> Add process</button>
    </div>
  );
}
