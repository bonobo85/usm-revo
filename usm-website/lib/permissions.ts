// Helpers pour les vérifications de rang et permissions

export const RANGS = {
  SHERIFF: 9,
  LEADER: 8,
  COLEADER: 7,
  OPERATEUR: 6,
  OPERATEUR_2: 5,
  FORMATEUR: 4,
  CONFIRME: 3,
  USM: 2,
  BCSO: 1,
} as const;

export const NOMS_RANGS: Record<number, string> = {
  9: 'Shériff',
  8: 'Leader',
  7: 'Co-Leader',
  6: 'Opérateur',
  5: 'Opérateur Second',
  4: 'Formateur',
  3: 'USM Confirmé',
  2: 'USM',
  1: 'BCSO',
};

export const COULEURS_RANGS: Record<number, string> = {
  9: '#C9994F', // Or (Shériff)
  8: '#B32134', // Rouge USM (Leader)
  7: '#D43A4F', // Rouge clair (Co-Leader)
  6: '#A67C4E', // Bronze (Opérateur)
  5: '#8B6A42', // Bronze foncé (Opérateur Second)
  4: '#2E5AA8', // Bleu USM clair (Formateur)
  3: '#1B3E7C', // Bleu marine (USM Confirmé)
  2: '#6B7B9C', // Bleu gris (USM)
  1: '#4A5670', // Gris ardoise (BCSO)
};

export function aLeRang(monRang: number | undefined | null, minRequis: number): boolean {
  if (!monRang) return false;
  return monRang >= minRequis;
}

export function aLaPermission(
  permissions: string[] | undefined | null,
  perm: string
): boolean {
  if (!permissions) return false;
  return permissions.includes(perm);
}

// Vérifie qu'un user ne peut pas attribuer un rang >= au sien
export function peutAttribuerRang(
  monRang: number,
  rangCible: number
): boolean {
  return rangCible < monRang;
}

// Couleur d'un rang
export function couleurRang(level: number): string {
  return COULEURS_RANGS[level] || '#6B7280';
}

// Nom d'un rang
export function nomRang(level: number): string {
  return NOMS_RANGS[level] || 'Inconnu';
}

// ==============================
// Helpers de seuils (lisibilité)
// ==============================
export const estOpSecondMin = (r?: number | null) => aLeRang(r, RANGS.OPERATEUR_2);
export const estOperateurMin = (r?: number | null) => aLeRang(r, RANGS.OPERATEUR);
export const estColeadMin = (r?: number | null) => aLeRang(r, RANGS.COLEADER);
export const estLeadMin = (r?: number | null) => aLeRang(r, RANGS.LEADER);

// ==============================
// Visibilité CRASH / Formateurs
// ==============================
export function peutVoirCrash(rang?: number | null, badges?: string[] | null): boolean {
  return estColeadMin(rang) || (badges?.includes('CRASH') ?? false);
}

export function peutVoirFormateurs(rang?: number | null, badges?: string[] | null): boolean {
  return estColeadMin(rang) || (badges?.includes('FORMATEUR') ?? false);
}

// ==============================
// Badges : ordre fixe d'affichage
// ==============================
export const ORDRE_BADGES: Record<string, number> = {
  CRASH: 1,
  FORMATEUR: 2,
  INSTRUCTEUR: 3,
  NEGOCIATEUR: 4,
  BMO: 5,
  DRONE: 6,
  GAV: 7,
  BRACELET: 8,
  FEDERAL: 9,
};

export function trierBadges<T extends { code: string }>(badges: T[]): T[] {
  return [...badges].sort(
    (a, b) => (ORDRE_BADGES[a.code] || 99) - (ORDRE_BADGES[b.code] || 99)
  );
}
