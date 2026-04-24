'use client';

import { cn } from '@/lib/utils';

type BadgeInfo = { code: string; nom?: string; couleur?: string };

export function BadgeTag({
  badge,
  taille = 'sm',
  className,
}: {
  badge: BadgeInfo;
  taille?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const couleur = badge.couleur || '#6B7280';
  const tailleCls = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }[taille];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-semibold uppercase tracking-wide whitespace-nowrap',
        tailleCls,
        className
      )}
      style={{ backgroundColor: couleur, color: contrast(couleur) }}
    >
      {badge.code}
    </span>
  );
}

export function BadgesRow({
  badges,
  taille = 'sm',
  max,
}: {
  badges: BadgeInfo[];
  taille?: 'xs' | 'sm' | 'md';
  max?: number;
}) {
  const ordre: Record<string, number> = {
    CRASH: 1, FORMATEUR: 2, INSTRUCTEUR: 3, NEGOCIATEUR: 4,
    BMO: 5, DRONE: 6, GAV: 7, BRACELET: 8, FEDERAL: 9,
  };
  const tries = [...badges].sort((a, b) => (ordre[a.code] ?? 99) - (ordre[b.code] ?? 99));
  const affiches = max ? tries.slice(0, max) : tries;
  const restants = max && tries.length > max ? tries.length - max : 0;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {affiches.map((b) => (
        <BadgeTag key={b.code} badge={b} taille={taille} />
      ))}
      {restants > 0 && (
        <span className="text-xs text-texte-gris">+{restants}</span>
      )}
    </div>
  );
}

// Simple contrast helper (noir ou blanc selon la couleur de fond)
function contrast(hex: string): string {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? '#000' : '#fff';
  } catch {
    return '#fff';
  }
}
