import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Flame, Info, LucideIcon, Scale, Snowflake } from 'lucide-react';
import type { HeatCell, NamedScore } from '../core/models';
import { scoring } from '../core/scoring';
import { MONTH_NAMES, parseIso, shortDate } from '../core/date';
import { BAND_LABEL, bandColor } from './areas';
import { usePrivate } from '../core/privacy';

// --- private text -------------------------------------------------------------

/** Personal text. In private mode it renders as a blank pill — the text never reaches the page. */
export function Pv({ children }: { children: string | null | undefined }) {
  const hidden = usePrivate();
  if (!hidden || !children) return <>{children}</>;
  return <span className="pv" role="img" aria-label="Hidden" style={{ width: `${Math.min(10, 3 + children.length / 4)}em` }} />;
}

// --- progress ring ------------------------------------------------------------

export function Ring({
  value,
  size = 120,
  stroke = 12,
  color,
  marker,
  children,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
  marker?: number; // 0..100 tick (e.g. minimum viable day)
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const angle = marker != null ? (marker / 100) * 2 * Math.PI - Math.PI / 2 : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? bandColor(scoring.band(pct))}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ type: 'spring', stiffness: 70, damping: 16 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {marker != null && marker > 0 && (
          <circle cx={size / 2 + r * Math.cos(angle)} cy={size / 2 + r * Math.sin(angle)} r={stroke / 3.2} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2}>
            <title>Minimum viable day: {marker}</title>
          </circle>
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// --- streak -------------------------------------------------------------------

export function StreakFlame({ days, size = 'md' }: { days: number; size?: 'md' | 'lg' }) {
  const px = size === 'lg' ? 34 : 24;
  return (
    <div className={`streak streak--${size} ${days > 0 ? 'lit' : 'out'}`} title={`${days}-day streak`}>
      <Flame size={px} strokeWidth={2.2} className="streak-icon" />
      <span className="streak-num">{days}</span>
    </div>
  );
}

// --- heatmap ------------------------------------------------------------------

export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const weeks: HeatCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="heatmap">
      {weeks.map((w, i) => {
        const first = w.find((c) => parseIso(c.date).getDate() <= 7);
        return (
          <div className="heat-col" key={i}>
            <span className="heat-month">{first && i > 0 ? MONTH_NAMES[parseIso(first.date).getMonth()].slice(0, 3) : ''}</span>
            {w.map((c) => (
              <span
                key={c.date}
                className={`heat-cell ${c.inRange ? '' : 'off'}`}
                style={{ background: c.isFreeze ? 'var(--freeze)' : c.inRange ? bandColor(c.band) : undefined }}
                title={`${shortDate(c.date)} · ${c.isFreeze ? 'freeze day' : c.score}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// --- horizontal bars -----------------------------------------------------------

export function Bars({
  items,
  empty = 'Nothing here yet',
  ranked = false,
  personal = false,
}: {
  items: NamedScore[];
  empty?: string;
  ranked?: boolean;
  /** Labels are areas / goals / processes — hidden in private mode. */
  personal?: boolean;
}) {
  if (!items.length) return <p className="muted center">{empty}</p>;
  return (
    <ul className="bars">
      {items.map((it, i) => (
        <li key={(it.id ?? it.label) + i}>
          <span className="bar-label">
            {ranked && <span className={`rank rank-${i + 1}`}>{i + 1}</span>}
            {personal ? <Pv>{it.label}</Pv> : it.label}
            {it.sub && <small> · {personal ? <Pv>{it.sub}</Pv> : it.sub}</small>}
          </span>
          <span className="bar-track">
            <motion.span
              className="bar-fill"
              style={{ background: bandColor(scoring.band(it.score)) }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, it.score)}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 15, delay: i * 0.04 }}
            />
          </span>
          <span className="bar-num">{it.score}</span>
        </li>
      ))}
    </ul>
  );
}

export function BandChip({ score }: { score: number }) {
  const band = scoring.band(score);
  return (
    <span className="band-chip" style={{ ['--b' as string]: bandColor(band) }}>
      <span className="band-dot" />
      {BAND_LABEL[band]}
    </span>
  );
}

export function Stat({ label, value, icon: Icon, sub, tone }: { label: string; value: ReactNode; icon?: LucideIcon; sub?: string; tone?: string }) {
  return (
    <div className="stat card">
      {Icon && (
        <span className="stat-icon" style={tone ? { color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` } : undefined}>
          <Icon size={18} />
        </span>
      )}
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty card">
      <motion.span className="empty-icon" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.6 }}>
        <Icon size={34} />
      </motion.span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function FreezeIcon({ size = 16 }: { size?: number }) {
  return <Snowflake size={size} />;
}

// --- modal + confirm ---------------------------------------------------------------

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.94, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onCancel?: () => void;
}) {
  const cancel = () => {
    onCancel?.();
    onClose();
  };
  return (
    <Modal open={open} onClose={cancel} title={title}>
      <div className="modal-body">{message}</div>
      <div className="row end gap">
        <button className="btn ghost" onClick={cancel}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// --- toasts -------------------------------------------------------------------------

type Tone = 'success' | 'info' | 'error';
interface Toast { id: number; text: string; tone: Tone }
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
const TOAST_ICON: Record<Tone, LucideIcon> = { success: Check, info: Info, error: AlertCircle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.tone];
            return (
              <motion.div key={t.id} className={`toast ${t.tone}`} initial={{ y: 30, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0 }}>
                <span className="toast-icon"><Icon size={15} strokeWidth={3} /></span>
                {t.text}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// --- weight editor: sliders that must sum to 100 -------------------------------------

export interface WeightItem { key: string; label: string; weight: number; color?: string }

/** Spread 100 across n items as evenly as possible (remainder goes to the first ones). */
export function evenSplit(n: number, total = 100): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0));
}

export function WeightEditor({ items, onChange, target = 100 }: { items: WeightItem[]; onChange: (weights: number[]) => void; target?: number }) {
  const total = items.reduce((s, i) => s + (Number(i.weight) || 0), 0);
  const ok = total === target;
  const set = (idx: number, v: number) => onChange(items.map((it, i) => (i === idx ? Math.max(0, Math.min(100, Math.round(v))) : Number(it.weight) || 0)));
  return (
    <div className="weights">
      <div className="weight-stack" aria-hidden>
        {items.map((it) => (
          <span key={it.key} className="weight-seg" style={{ flexGrow: Number(it.weight) || 0, background: it.color ?? 'var(--accent)' }} />
        ))}
        {total < target && <span className="weight-seg empty" style={{ flexGrow: target - total }} />}
      </div>
      {items.map((it, i) => (
        <label className="weight-row" key={it.key}>
          <span className="weight-name">
            <span className="dot" style={{ background: it.color ?? 'var(--accent)' }} />
            {it.label ? <Pv>{it.label}</Pv> : <em className="muted">Untitled</em>}
          </span>
          <input type="range" min={0} max={100} value={it.weight} onChange={(e) => set(i, Number(e.target.value))} style={{ accentColor: it.color ?? 'var(--accent)' }} />
          <input className="input weight-num" type="number" min={0} max={100} value={it.weight} onChange={(e) => set(i, Number(e.target.value))} />
        </label>
      ))}
      <div className="row between wrap gap">
        <span className={`weight-total ${ok ? 'ok' : 'bad'}`}>
          {total} / {target} {ok ? '· balanced' : total > target ? `· ${total - target} over` : `· ${target - total} left`}
        </span>
        <button type="button" className="btn small ghost" onClick={() => onChange(evenSplit(items.length, target))}>
          <Scale size={15} /> Split evenly
        </button>
      </div>
    </div>
  );
}
