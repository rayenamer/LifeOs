import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDb } from '../core/store';
import { analytics } from '../core/analytics';
import { ArrowLeft, Award, CalendarCheck, Compass, Flame, Gauge, LucideIcon, TrendingDown, TriangleAlert } from 'lucide-react';
import { Bars, Ring } from '../ui/components';

/** "Month wrapped" — the monthly review as a stack of playful cards. */
export function MonthReview() {
  const params = useParams();
  const mk = { year: Number(params.year), month: Number(params.month) };
  const v = useDb(() => analytics.monthlyReview(mk), [mk.year, mk.month]);

  const cards = [
    { icon: Gauge, title: 'Month score', big: v.monthScore, sub: 'average daily score', tone: 'violet' },
    { icon: CalendarCheck, title: 'Days you showed up', big: `${v.activeDays}/${v.totalDays}`, sub: 'active days', tone: 'mint' },
    { icon: Flame, title: 'Streak at month end', big: v.streakDays, sub: 'days in a row', tone: 'coral' },
    v.bestProcess && { icon: Award, title: 'Best process', big: v.bestProcess.label, sub: `${v.bestProcess.score}% · ${v.bestProcess.sub}`, tone: 'amber' },
    v.mostConsistentArea && { icon: Compass, title: 'Most consistent area', big: v.mostConsistentArea.label, sub: `${v.mostConsistentArea.score} pts`, tone: 'sky' },
    v.weakestProcess && v.weakestProcess !== v.bestProcess && { icon: TriangleAlert, title: 'Weakest process', big: v.weakestProcess.label, sub: `${v.weakestProcess.score}% · ${v.weakestProcess.sub}`, tone: 'pink' },
    v.biggestDrop && { icon: TrendingDown, title: 'Biggest drop vs last month', big: v.biggestDrop.label, sub: v.biggestDrop.sub ?? '', tone: 'slate' },
  ].filter(Boolean) as { icon: LucideIcon; title: string; big: string | number; sub: string; tone: string }[];

  return (
    <div className="page">
      <Link to={`/months/${mk.year}/${mk.month}`} className="back"><ArrowLeft size={15} /> Back to month</Link>
      <header className="page-head center">
        <p className="eyebrow">Monthly review</p>
        <h1>{v.label} — wrapped</h1>
      </header>
      <div className="wrapped">
        {cards.map((c, i) => (
          <motion.section
            key={c.title}
            className={`wrap-card tone-${c.tone}`}
            initial={{ opacity: 0, y: 40, rotate: i % 2 ? 2 : -2 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 120, damping: 16, delay: i * 0.05 }}
          >
            <span className="wrap-icon"><c.icon size={30} /></span>
            <small>{c.title}</small>
            <b className="wrap-big">{c.big}</b>
            <span>{c.sub}</span>
          </motion.section>
        ))}
      </div>
      <section className="card">
        <div className="row between center-y">
          <h3>Areas</h3>
          <Ring value={v.monthScore} size={56} stroke={7}><b className="mini-num">{v.monthScore}</b></Ring>
        </div>
        <Bars items={v.areaScores} empty="No goals that month" />
      </section>
    </div>
  );
}
