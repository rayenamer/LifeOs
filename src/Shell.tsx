import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CalendarDays, Eye, EyeOff, HardDrive, HardDriveDownload, LucideIcon, NotebookPen, Plus, Settings, Sun } from 'lucide-react';
import { useDb, useDisk } from './core/store';
import { privacy, usePrivate } from './core/privacy';
import { areaRepo, streakRepo } from './core/repos';
import { FreezeIcon, StreakFlame } from './ui/components';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Today', icon: Sun, end: true },
  { to: '/months', label: 'Months', icon: CalendarDays },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/reflection', label: 'Reflect', icon: NotebookPen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Shell() {
  const location = useLocation();
  const { empty, streak } = useDb(() => ({ empty: areaRepo.all().length === 0, streak: streakRepo.get() }));
  const d = useDisk();
  const hidden = usePrivate();
  const privateToggle = {
    onClick: privacy.toggle,
    'aria-pressed': hidden,
    title: hidden ? 'Private mode is on — show personal text' : 'Private mode: hide personal text, keep the numbers',
  };

  // First run with nothing in the database → onboarding (start fresh or import).
  if (empty && !sessionGet('onboarded') && location.pathname === '/') return <Navigate to="/welcome" replace />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">LifeOS</span>
          <button type="button" className={`privacy-btn ${hidden ? 'on' : ''}`} {...privateToggle} aria-label="Private mode">
            {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/goals/new" className="btn primary new-goal">
          <Plus size={17} strokeWidth={2.6} /> New goal
        </NavLink>
        <div className="side-foot">
          <div className="side-streak card">
            <StreakFlame days={streak.currentStreak} />
            <div>
              <b>{streak.currentStreak} day streak</b>
              <small>
                best {streak.longestStreak} · <FreezeIcon size={12} /> {streak.freezeDaysAvailable}
              </small>
            </div>
          </div>
          <NavLink to="/settings" className={`disk-pill ${d.available && !d.error ? 'ok' : 'warn'}`} title={d.error ?? d.path ?? ''}>
            {d.available && !d.error ? <HardDrive size={14} /> : <HardDriveDownload size={14} />}
            {d.available && !d.error ? 'Saved to data/lifeos.sqlite' : 'Not saving to disk'}
          </NavLink>
        </div>
      </aside>

      <button type="button" className={`mobile-gear mobile-privacy ${hidden ? 'on' : ''}`} {...privateToggle} aria-label="Private mode">
        {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
      <NavLink to="/settings" className="mobile-gear" aria-label="Settings">
        <Settings size={19} />
      </NavLink>
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="tabbar">
        {NAV.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon size={20} />
            <small>{label}</small>
          </NavLink>
        ))}
        <NavLink to="/goals/new" className="tab tab-plus" aria-label="New goal">
          <Plus size={24} strokeWidth={2.6} />
        </NavLink>
        {NAV.slice(2, 4).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="tab">
            <Icon size={20} />
            <small>{label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
