import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-fond">
      <div className="max-w-md text-center">
        <Image src="/logos/usm.png" alt="USM" width={100} height={100} className="mx-auto mb-4" />
        <h1 className="text-6xl font-bold text-or mb-2">404</h1>
        <p className="text-white text-xl mb-2">Page introuvable</p>
        <p className="text-texte-gris mb-6">
          Ce dossier n'existe pas ou a été archivé.
        </p>
        <Link href="/dashboard" className="bouton-bleu inline-block">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
