import confetti from 'canvas-confetti';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function accent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c5cff';
}

/** Small pop of sparkles at an element — completing a single process. */
export function popAt(el: Element | null, color?: string): void {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect();
  void confetti({
    particleCount: 28,
    spread: 60,
    startVelocity: 22,
    ticks: 90,
    scalar: 0.8,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    colors: [color ?? accent(), '#ffd166', '#ffffff'],
  });
}

/** Crossing the minimum viable day — the day is secured. */
export function celebrate(): void {
  if (reduced()) return;
  void confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 }, colors: [accent(), '#ffd166', '#3ccf91', '#ff7a8a'] });
}

/** A perfect 100 day, or creating a goal. */
export function fireworks(): void {
  if (reduced()) return;
  const end = Date.now() + 900;
  const colors = [accent(), '#ffd166', '#3ccf91', '#ff7a8a', '#5ec8ff'];
  (function frame() {
    void confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors });
    void confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
