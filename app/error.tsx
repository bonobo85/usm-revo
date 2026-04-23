'use client';

import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-fond">
      <div className="max-w-md w-full text-center">
        <Image src="/logos/usm.png" alt="USM" width={80} height={80} className="mx-auto mb-4" />
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Une erreur s'est produite</h1>
        <p className="text-texte-gris mb-6">
          Une anomalie a été détectée dans le système. Veuillez réessayer.
        </p>
        <p className="text-xs text-red-400 mb-6 font-mono bg-red-900/20 p-2 rounded">
          {error.message}
        </p>
        <button onClick={reset} className="bouton-bleu">
          Réessayer
        </button>
      </div>
    </div>
  );
}
