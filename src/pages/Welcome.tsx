import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { ImportPanel } from '../ui/ImportPanel';

const LOOP = ['Monthly goals', 'Daily processes', 'Daily score', 'Streak', 'Weekly reflection', 'Better system'];

export function Welcome() {
  const navigate = useNavigate();
  const enter = (to: string) => {
    try {
      sessionStorage.setItem('onboarded', '1');
    } catch {
      /* private mode — fine */
    }
    navigate(to);
  };

  return (
    <div className="welcome">
      <motion.div className="welcome-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <span className="brand-mark big" />
        <h1>LifeOS</h1>
        <p className="lead">Turn big goals into small daily processes. Show up, score points, keep the streak alive.</p>
        <ol className="loop">
          {LOOP.map((s, i) => (
            <motion.li key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
              <span>{s}</span>
              {i < LOOP.length - 1 && <ChevronRight size={16} className="muted" />}
            </motion.li>
          ))}
        </ol>
      </motion.div>

      <div className="welcome-choices">
        <motion.section className="card choice" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <h2>Bring my data</h2>
          <p className="muted">
            Coming from the original LifeOS? Open it, go to <b>Settings → Data vault → Export</b>, then drop the file here.
          </p>
          <ImportPanel hasData={false} onDone={() => enter('/')} />
        </motion.section>

        <motion.section className="card choice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <h2>Start fresh</h2>
          <p className="muted">Pick a life area, set this month's goal, and define the daily processes that move it.</p>
          <button className="btn primary big" onClick={() => enter('/goals/new')}>
            Create my first goal <ArrowRight size={18} />
          </button>
          <button className="btn ghost" onClick={() => enter('/')}>Just look around</button>
        </motion.section>
      </div>
    </div>
  );
}
