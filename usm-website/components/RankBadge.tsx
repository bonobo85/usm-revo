import { cn } from '@/lib/utils';
import { nomRang, couleurRang } from '@/lib/permissions';

type Props = {
  rang: number;
  taille?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function RankBadge({ rang, taille = 'md', className }: Props) {
  const couleur = couleurRang(rang);
  const nom = nomRang(rang);

  const tailles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-semibold border',
        tailles[taille],
        className
      )}
      style={{
        color: couleur,
        borderColor: couleur + '66',
        backgroundColor: couleur + '1A',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: couleur }}
      />
      {nom}
    </span>
  );
}
