'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  titre?: string;
  children: React.ReactNode;
  taille?: 'sm' | 'md' | 'lg' | 'xl';
};

export function Modal({ ouvert, onFermer, titre, children, taille = 'md' }: Props) {
  useEffect(() => {
    function onEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer();
    }
    if (ouvert) document.addEventListener('keydown', onEchap);
    return () => document.removeEventListener('keydown', onEchap);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  const tailles = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70" onClick={onFermer} />
      <div
        className={`relative bg-fond-carte border border-gris-bordure rounded-lg shadow-2xl w-full ${tailles[taille]} max-h-[90vh] overflow-y-auto`}
      >
        {titre && (
          <div className="sticky top-0 bg-fond-carte border-b border-gris-bordure p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{titre}</h2>
            <button onClick={onFermer} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
