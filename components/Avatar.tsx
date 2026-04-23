import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  nom: string;
  taille?: number;
  className?: string;
};

export function Avatar({ src, nom, taille = 40, className }: Props) {
  const initiales = nom
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={nom}
        width={taille}
        height={taille}
        className={cn('rounded-full object-cover', className)}
        style={{ width: taille, height: taille }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-bleu flex items-center justify-center text-white font-semibold',
        className
      )}
      style={{ width: taille, height: taille, fontSize: taille / 2.5 }}
    >
      {initiales || '?'}
    </div>
  );
}
