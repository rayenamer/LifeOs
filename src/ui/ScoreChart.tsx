import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Table2 } from 'lucide-react';
import type { ScorePoint } from '../core/models';
import { useDb } from '../core/store';
import { analytics } from '../core/analytics';
import { MONTH_NAMES, parseIso, WEEKDAY_NAMES } from '../core/date';

/**
 * Daily score over time: one column per calendar day (context) and the trailing
 * 7-day average as the line (the signal), against the minimum-viable-day
 * reference. Crosshair tooltip on hover / arrow keys; table view for every value.
 */

const RANGES = [
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: '180', label: '6M', days: 180 },
  { key: 'all', label: 'All', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const H = 260;
const M = { top: 18, right: 44, bottom: 30, left: 34 };
const Y_TICKS = [0, 25, 50, 75, 100];

const fmtDay = (iso: string) => {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
};
const fmtLong = (iso: string) => `${WEEKDAY_NAMES[parseIso(iso).getDay()].slice(0, 3)} ${fmtDay(iso)} ${iso.slice(0, 4)}`;

function status(p: ScorePoint, mvd: number): string {
  if (p.isToday) return 'In progress';
  if (p.isFreeze) return 'Freeze day';
  if (!p.logged) return 'Nothing logged';
  return p.score >= mvd ? 'Secured' : 'Below minimum';
}

function readRange(): RangeKey {
  try {
    const v = localStorage.getItem('insights-range');
    if (RANGES.some((r) => r.key === v)) return v as RangeKey;
  } catch {
    /* storage unavailable */
  }
  return '90';
}

/** Date ticks that never collide: pick a cadence from the span, then drop any closer than `minGap` px. */
function xTicks(points: ScorePoint[], x: (i: number) => number, minGap = 64): { i: number; label: string }[] {
  const n = points.length;
  const cand: { i: number; label: string }[] = [];
  points.forEach((p, i) => {
    const d = parseIso(p.date);
    if (n <= 16) cand.push({ i, label: fmtDay(p.date) });
    else if (n <= 75 && d.getDay() === 1) cand.push({ i, label: fmtDay(p.date) });
    else if (n > 75 && d.getDate() === 1) {
      const m = MONTH_NAMES[d.getMonth()].slice(0, 3);
      cand.push({ i, label: d.getMonth() === 0 || n > 400 ? `${m} ${String(d.getFullYear()).slice(2)}` : m });
    }
  });
  const out: { i: number; label: string }[] = [];
  for (const t of cand) if (!out.length || x(t.i) - x(out[out.length - 1].i) >= minGap) out.push(t);
  return out;
}

export function ScoreChart({ mvd }: { mvd: number }) {
  const [range, setRange] = useState<RangeKey>(readRange);
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const days = RANGES.find((r) => r.key === range)!.days;
  const s = useDb(() => analytics.scoreSeries(days), [days]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pickRange = (k: RangeKey) => {
    setRange(k);
    setActive(null);
    try {
      localStorage.setItem('insights-range', k);
    } catch {
      /* fine */
    }
  };

  const pts = s.points;
  const n = pts.length;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const band = n ? plotW / n : plotW;
  const x = (i: number) => M.left + band * i + band / 2;
  const y = (v: number) => M.top + plotH - (v / 100) * plotH;
  const columns = band >= 3; // too dense for columns → daily values drawn as a wash instead
  const gap = band > 8 ? 2 : 1;
  const colW = Math.min(24, Math.max(1, band - gap));

  const { linePath, areaPath, lastAvg } = useMemo(() => {
    let line = '';
    let last: { i: number; v: number } | null = null;
    let pen = false;
    pts.forEach((p, i) => {
      if (p.avg7 == null) {
        pen = false;
        return;
      }
      line += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avg7).toFixed(1)}`;
      pen = true;
      last = { i, v: p.avg7 };
    });
    const area = pts.length
      ? `M${x(0)},${y(0)} ` + pts.map((p, i) => `L${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ') + ` L${x(n - 1)},${y(0)} Z`
      : '';
    return { linePath: line, areaPath: area, lastAvg: last as { i: number; v: number } | null };
    // x/y derive from width & n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, width]);

  const ticks = useMemo(() => xTicks(pts, x), [pts, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / band);
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    const cur = active ?? n - 1;
    const next = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, next)));
  };

  const delta = s.prevAvg == null ? null : s.avg - s.prevAvg;
  const current7 = [...pts].reverse().find((p) => p.avg7 != null)?.avg7 ?? null;
  const ap = active != null ? pts[active] : null;
  const tipLeft = active != null ? x(active) : 0;
  const flip = tipLeft > width - 190;

  return (
    <section className="card score-chart">
      <div className="chart-head">
        <div>
          <h3>Daily score</h3>
          <p className="muted small-text">Columns are days, the line is the 7-day average.</p>
        </div>
        <div className="row gap center-y">
          <div className="seg" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.key} className={range === r.key ? 'on' : ''} aria-pressed={range === r.key} onClick={() => pickRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <button className={`btn small ghost ${showTable ? 'on' : ''}`} aria-pressed={showTable} onClick={() => setShowTable((t) => !t)} title="Show the values as a table">
            <Table2 size={15} /> Table
          </button>
        </div>
      </div>

      {n < 2 ? (
        <p className="muted center chart-empty">Log a couple of days to see your score over time.</p>
      ) : (
        <>
          <div className="chart-figures">
            <div className="figure">
              <span className="figure-label">Average</span>
              <span className="figure-value">{s.avg}</span>
              {delta != null && (
                <span className={`figure-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`} title={`Previous ${s.completedDays} days: ${s.prevAvg}`}>
                  {delta > 0 ? <ArrowUpRight size={14} /> : delta < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                  {delta > 0 ? '+' : ''}
                  {delta} vs previous period
                </span>
              )}
            </div>
            <div className="figure">
              <span className="figure-label">7-day average</span>
              <span className="figure-value">{current7 ?? '–'}</span>
            </div>
            <div className="figure">
              <span className="figure-label">Days secured</span>
              <span className="figure-value">
                {s.securedDays}
                <small>/{s.completedDays}</small>
              </span>
              <span className="figure-sub">{s.completedDays ? Math.round((s.securedDays / s.completedDays) * 100) : 0}% met the minimum</span>
            </div>
            <div className="figure">
              <span className="figure-label">Best day</span>
              <span className="figure-value">{s.best?.score ?? '–'}</span>
              {s.best && <span className="figure-sub">{fmtDay(s.best.date)}</span>}
            </div>
          </div>

          <div className="chart-wrap" ref={wrapRef}>
            <svg
              width={width}
              height={H}
              role="img"
              tabIndex={0}
              aria-label={`Daily score, ${n} days. Average ${s.avg}. Use the arrow keys to read individual days.`}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              className="chart-svg"
            >
              {/* grid + y axis */}
              {Y_TICKS.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-line' : 'grid-line'} />
                  <text x={M.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                    {t}
                  </text>
                </g>
              ))}

              {/* daily values */}
              {columns ? (
                pts.map((p, i) => {
                  if (p.score <= 0) return null;
                  const h = y(0) - y(p.score);
                  const r = Math.min(4, colW / 2, h);
                  const x0 = x(i) - colW / 2;
                  const top = y(p.score);
                  return (
                    <path
                      key={p.date}
                      d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + colW - r} Q${x0 + colW},${top} ${x0 + colW},${top + r} V${y(0)} Z`}
                      className={`col ${p.isFreeze ? 'freeze' : ''} ${p.isToday ? 'today' : ''} ${active === i ? 'hot' : ''} ${active != null && active !== i ? 'dim' : ''}`}
                    />
                  );
                })
              ) : (
                <path d={areaPath} className="col-wash" />
              )}

              {/* minimum viable day reference */}
              {mvd > 0 && (
                <g className="ref">
                  <line x1={M.left} x2={width - M.right} y1={y(mvd)} y2={y(mvd)} />
                </g>
              )}

              {/* 7-day average */}
              <path d={linePath} className="avg-line" />

              {/* freeze days: marker on the baseline */}
              {pts.map((p, i) => (p.isFreeze ? <circle key={'f' + p.date} cx={x(i)} cy={y(0)} r={4} className="freeze-dot" /> : null))}

              {/* reference label sits above every mark so nothing crosses it */}
              {mvd > 0 && (
                <g className="ref">
                  <text x={M.left + 6} y={y(mvd) - 6}>Minimum viable day · {mvd}</text>
                </g>
              )}

              {lastAvg && active == null && (
                <g>
                  <circle cx={x(lastAvg.i)} cy={y(lastAvg.v)} r={4} className="avg-dot" />
                  <text x={x(lastAvg.i) + 9} y={y(lastAvg.v)} className="end-label" dominantBaseline="middle">
                    {lastAvg.v}
                  </text>
                </g>
              )}

              {/* x axis */}
              {ticks.map((t) => (
                <text key={t.i} x={x(t.i)} y={H - 10} className="tick" textAnchor="middle">
                  {t.label}
                </text>
              ))}

              {/* crosshair */}
              {ap && (
                <g pointerEvents="none">
                  <line x1={x(active!)} x2={x(active!)} y1={M.top} y2={y(0)} className="crosshair" />
                  {ap.avg7 != null && <circle cx={x(active!)} cy={y(ap.avg7)} r={4} className="avg-dot" />}
                </g>
              )}

              <rect
                x={M.left}
                y={M.top}
                width={plotW}
                height={plotH}
                fill="transparent"
                onPointerMove={onMove}
                onPointerDown={onMove}
                onPointerLeave={() => setActive(null)}
              />
            </svg>

            {ap && (
              <div className="chart-tip" style={{ left: tipLeft, transform: `translateX(${flip ? 'calc(-100% - 12px)' : '12px'})` }}>
                <div className="tip-date">{fmtLong(ap.date)}</div>
                <div className="tip-row">
                  <span className="key key-col" />
                  <b>{ap.score}</b>
                  <span>Daily score</span>
                </div>
                <div className="tip-row">
                  <span className="key key-line" />
                  <b>{ap.avg7 ?? '–'}</b>
                  <span>7-day average</span>
                </div>
                <div className={`tip-status s-${status(ap, mvd).toLowerCase().replace(/ /g, '-')}`}>{status(ap, mvd)}</div>
              </div>
            )}
          </div>

          <div className="chart-legend">
            <span><span className="key key-col" /> Daily score</span>
            <span><span className="key key-line" /> 7-day average</span>
            <span><span className="key key-ref" /> Minimum viable day</span>
            {pts.some((p) => p.isFreeze) && <span><span className="key key-freeze" /> Freeze day</span>}
          </div>

          {showTable && (
            <div className="chart-table">
              <table>
                <thead>
                  <tr><th>Date</th><th>Score</th><th>7-day avg</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {[...pts].reverse().map((p) => (
                    <tr key={p.date}>
                      <td>{fmtLong(p.date)}</td>
                      <td className="num">{p.score}</td>
                      <td className="num">{p.avg7 ?? '–'}</td>
                      <td>{status(p, mvd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
