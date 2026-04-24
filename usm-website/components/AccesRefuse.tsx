'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShieldX } from 'lucide-react';

export function AccesRefuse({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md text-center">
        <Image src="/logos/usm.png" alt="USM" width={80} height={80} className="mx-auto mb-4 opacity-50" />
        <ShieldX size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Accès refusé</h1>
        <p className="text-texte-gris mb-6">
          {message || "Votre rang ne vous permet pas d'accéder à cette section."}
        </p>
        <Link href="/dashboard" className="bouton-bleu inline-block">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
