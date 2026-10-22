import { useState } from 'react';
import { AlertTriangle, Download, HardDrive, Minus, Monitor, Moon, Palette, Plus, Sun } from 'lucide-react';
import { useDb, useDisk } from '../core/store';
import { goals, settings } from '../core/services';
import { areaRepo, streakRepo } from '../core/repos';
import { disk } from '../db/disk';
import type { ThemeMode } from '../core/models';
import { Confirm, FreezeIcon, useToast } from '../ui/components';
import { ImportPanel, exportDatabase } from '../ui/ImportPanel';
import { AreaBadge, areaColor, areaIconName, IconPicker } from '../ui/areas';

const ACCENTS = ['#6d5efc', '#f2668b', '#22b07d', '#f0a030', '#3aa7e8', '#d65db1', '#0fa3b1', '#e5484d'];
const THEMES: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'auto', label: 'Auto', icon: Monitor },
  { mode: 'dark', label: 'Dark', icon: Moon },
];

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Settings() {
  const toast = useToast();
  const s = useDb(() => settings.get());
  const streak = useDb(() => streakRepo.get());
  const areas = useDb(() => areaRepo.all());
  const d = useDisk();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const [editingArea, setEditingArea] = useState<string | null>(null);

  const reset = async () => {
    try {
      await disk.backup();
      await settings.wipeAllData();
      toast('Everything reset. A backup was kept in data/backups.', 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <div className="page settings">
      <header className="page-head">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
      </header>

      <section className="card">
        <h3>Appearance</h3>
        <div className="seg">
          {THEMES.map(({ mode, label, icon: Icon }) => (
            <button key={mode} className={s.theme === mode ? 'on' : ''} onClick={() => settings.setTheme(mode)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`swatch ${s.accent.toLowerCase() === c ? 'sel' : ''}`} style={{ background: c }} aria-label={`Accent ${c}`} onClick={() => settings.setAccent(c)} />
          ))}
          <label className="swatch custom" title="Custom colour">
            <Palette size={18} />
            <input type="color" value={s.accent} onChange={(e) => settings.setAccent(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Rules</h3>
        <label className="field">
          <span>Minimum viable day — <b>{s.minimumViableDay} pts</b></span>
          <input type="range" min={0} max={100} step={5} value={s.minimumViableDay} onChange={(e) => settings.setMinimumViableDay(Number(e.target.value))} />
          <small className="muted">A day counts toward your streak once your score reaches this. Consistency, not perfection.</small>
        </label>
        <div className="field">
          <span className="with-icon">
            <FreezeIcon /> Freeze days available — <b>{streak.freezeDaysAvailable}</b> <small className="muted">({streak.freezeDaysUsed} used so far)</small>
          </span>
          <div className="row gap center-y">
            <button className="btn icon ghost" aria-label="Fewer" onClick={() => settings.setFreezeDaysAvailable(streak.freezeDaysAvailable - 1)} disabled={streak.freezeDaysAvailable <= 0}>
              <Minus size={16} />
            </button>
            <span className="freeze-count">{streak.freezeDaysAvailable}</span>
            <button className="btn icon ghost" aria-label="More" onClick={() => settings.setFreezeDaysAvailable(streak.freezeDaysAvailable + 1)}>
              <Plus size={16} />
            </button>
          </div>
          <small className="muted">A freeze protects your streak on a rough day without pretending you did the work.</small>
        </div>
      </section>

      <section className="card">
        <h3 className="with-icon"><HardDrive size={17} /> Storage</h3>
        {d.available ? (
          <div className={`vault ${d.error ? 'warn' : 'ok'}`}>
            <div className="stack tight">
              <code className="path">{d.path ?? 'data/lifeos.sqlite'}</code>
              <small className="muted">
                {fmtBytes(d.size)}
                {d.lastSavedAt ? ` · saved ${new Date(d.lastSavedAt).toLocaleTimeString()}` : ''} · {d.backups} backup{d.backups === 1 ? '' : 's'} in data/backups
              </small>
              {d.error && <small className="error">{d.error}</small>}
            </div>
          </div>
        ) : (
          <p className="warn">
            <AlertTriangle size={16} /> The LifeOS server isn't running, so changes are only kept in this browser. Start the app with <code>./start.sh</code> to save to <code>data/lifeos.sqlite</code>.
          </p>
        )}
        <p className="muted small-text">
          Every change is written to this file right away. Before the first save of each day, the previous version is copied to <code>data/backups</code> (last 30 days kept).
          It's a regular SQLite file — copy it anywhere, or open it with any SQLite tool.
        </p>
      </section>

      <section className="card">
        <h3>Import & export</h3>
        <p className="muted">Import a <code>.sqlite</code> from the original LifeOS (Settings → Export) or from a backup of this app. Same format both ways.</p>
        <button className="btn ghost" onClick={exportDatabase}>
          <Download size={16} /> Export a copy
        </button>
        <ImportPanel hasData={areas.length > 0} />
      </section>

      {areas.length > 0 && (
        <section className="card">
          <h3>Life areas</h3>
          <ul className="area-list">
            {areas.map((a) => (
              <li key={a.id}>
                <div className="row gap center-y">
                  <AreaBadge area={a} onClick={() => setEditingArea(editingArea === a.id ? null : a.id)} />
                  <input
                    className="input grow"
                    defaultValue={a.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && goals.updateArea(a.id, { name: e.target.value.trim() })}
                  />
                </div>
                {editingArea === a.id && (
                  <IconPicker value={areaIconName(a)} color={areaColor(a)} onPick={(icon) => { goals.updateArea(a.id, { icon }); setEditingArea(null); }} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card danger-zone">
        <h3>Danger zone</h3>
        <p className="muted">Wipe every goal, check-in, score and reflection. A copy of the current file is kept in data/backups first.</p>
        <button className="btn danger" onClick={() => { setResetText(''); setConfirmReset(true); }}>Reset everything</button>
      </section>

      <Confirm
        open={confirmReset}
        danger
        title="Reset everything?"
        message={
          <div className="stack">
            <p>Type <b>RESET</b> to confirm.</p>
            <input className="input public" value={resetText} onChange={(e) => setResetText(e.target.value)} autoFocus />
          </div>
        }
        confirmLabel="Wipe it all"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => (resetText === 'RESET' ? void reset() : toast('Type RESET to confirm', 'error'))}
      />
    </div>
  );
}
