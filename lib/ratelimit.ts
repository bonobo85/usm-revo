// Rate limiter simple en mémoire (pour Vercel, ça marche par instance serverless)
// Pour du multi-instance, utiliser Upstash Redis ou équivalent

type Compteur = { total: number; reset: number };
const compteurs = new Map<string, Compteur>();

// Nettoyage toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [cle, v] of compteurs.entries()) {
    if (v.reset < now) compteurs.delete(cle);
  }
}, 5 * 60 * 1000);

export type Limite = {
  max: number;           // nombre max de requêtes
  fenetre: number;       // en millisecondes
};

export const LIMITES = {
  // Par défaut : 60 req / minute
  standard: { max: 60, fenetre: 60_000 } as Limite,
  // Upload : 10 / minute
  upload: { max: 10, fenetre: 60_000 } as Limite,
  // Création contenu : 20 / minute
  creation: { max: 20, fenetre: 60_000 } as Limite,
  // Action sensible (archivage, etc.) : 5 / minute
  sensible: { max: 5, fenetre: 60_000 } as Limite,
};

export function verifierLimite(
  cle: string,
  limite: Limite = LIMITES.standard
): { ok: boolean; restant: number; resetDans: number } {
  const now = Date.now();
  const c = compteurs.get(cle);

  if (!c || c.reset < now) {
    compteurs.set(cle, { total: 1, reset: now + limite.fenetre });
    return { ok: true, restant: limite.max - 1, resetDans: limite.fenetre };
  }

  if (c.total >= limite.max) {
    return { ok: false, restant: 0, resetDans: c.reset - now };
  }

  c.total += 1;
  return { ok: true, restant: limite.max - c.total, resetDans: c.reset - now };
}

// Récupère l'IP depuis les headers Next
export function getIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'inconnu'
  );
}
