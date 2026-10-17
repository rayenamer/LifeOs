import {
  Apple, BookOpen, Brain, Briefcase, Code2, Coffee, Dumbbell, Globe, Heart, Home, Leaf, LucideIcon, Moon,
  Mountain, Music, Palette, PenLine, Rocket, Sprout, Star, Sun, Target, TrendingUp, Users, Wallet,
} from 'lucide-react';
import type { LifeArea, ScoreBand } from '../core/models';

/** Each life area gets a stable colour from its position. */
export const AREA_COLORS = ['#6d5efc', '#f2668b', '#22b07d', '#f0a030', '#3aa7e8', '#d65db1', '#7bb32e', '#ef7d3c'];

export function areaColor(area: Pick<LifeArea, 'position' | 'name'> | null | undefined): string {
  if (!area) return AREA_COLORS[0];
  const i = Number.isFinite(area.position) ? area.position : [...area.name].reduce((h, c) => h + c.charCodeAt(0), 0);
  return AREA_COLORS[Math.abs(i) % AREA_COLORS.length];
}

/** Icons are stored by name in life_area.icon (the Angular app leaves it empty). */
export const AREA_ICONS: Record<string, LucideIcon> = {
  target: Target, heart: Heart, dumbbell: Dumbbell, briefcase: Briefcase, book: BookOpen, wallet: Wallet,
  brain: Brain, code: Code2, palette: Palette, home: Home, moon: Moon, apple: Apple, sprout: Sprout,
  music: Music, globe: Globe, users: Users, pen: PenLine, trending: TrendingUp, rocket: Rocket,
  star: Star, sun: Sun, leaf: Leaf, mountain: Mountain, coffee: Coffee,
};

const KEYWORDS: [RegExp, string][] = [
  [/health|fit|gym|sport|body|run|workout/i, 'dumbbell'],
  [/career|work|job|business|startup/i, 'briefcase'],
  [/learn|study|school|read|book|skill|educat/i, 'book'],
  [/money|financ|wealth|save|invest/i, 'wallet'],
  [/relation|love|family|friend|social/i, 'heart'],
  [/mind|mental|medit|spirit|calm/i, 'brain'],
  [/code|dev|program|tech/i, 'code'],
  [/creat|art|music|write|design/i, 'palette'],
  [/home|clean|house/i, 'home'],
  [/sleep|rest/i, 'moon'],
  [/food|diet|nutri|eat/i, 'apple'],
];

export function areaIconName(area: Pick<LifeArea, 'icon' | 'name'> | null | undefined): string {
  if (!area) return 'target';
  if (area.icon && AREA_ICONS[area.icon]) return area.icon;
  return KEYWORDS.find(([re]) => re.test(area.name))?.[1] ?? 'target';
}

export function AreaBadge({
  area,
  size = 'md',
  onClick,
}: {
  area: Pick<LifeArea, 'icon' | 'name' | 'position'> | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}) {
  const Icon = AREA_ICONS[areaIconName(area)];
  const px = { sm: 16, md: 20, lg: 26, xl: 34 }[size];
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={`area-badge ${size}`} style={{ background: areaColor(area) }} onClick={onClick} type={onClick ? 'button' : undefined}>
      <Icon size={px} strokeWidth={2.2} />
    </Tag>
  );
}

export function IconPicker({ value, onPick, color }: { value: string; onPick: (name: string) => void; color?: string }) {
  return (
    <div className="icon-grid">
      {Object.entries(AREA_ICONS).map(([name, Icon]) => (
        <button
          type="button"
          key={name}
          className={`icon-btn ${value === name ? 'sel' : ''}`}
          style={value === name && color ? { background: color, borderColor: color, color: '#fff' } : undefined}
          onClick={() => onPick(name)}
          aria-label={name}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  );
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  void: 'Not started',
  low: 'Warming up',
  mid: 'In motion',
  good: 'Strong',
  high: 'Excellent',
};

export const bandColor = (band: ScoreBand): string => `var(--band-${band})`;
