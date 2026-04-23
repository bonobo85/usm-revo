'use client';

import { cn } from '@/lib/utils';

type Onglet = { id: string; label: string; icone?: any };

type Props = {
  onglets: Onglet[];
  actif: string;
  onChange: (id: string) => void;
};

export function Tabs({ onglets, actif, onChange }: Props) {
  return (
    <div className="border-b border-gris-bordure mb-6">
      <div className="flex gap-1 overflow-x-auto">
        {onglets.map((o) => {
          const Icone = o.icone;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                actif === o.id
                  ? 'text-bleu-clair border-bleu-clair'
                  : 'text-gray-400 border-transparent hover:text-white'
              )}
            >
              {Icone && <Icone size={16} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
