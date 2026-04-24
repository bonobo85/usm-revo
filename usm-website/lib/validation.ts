// Validation simple sans dépendance externe

export class ErreurValidation extends Error {
  constructor(public champ: string, message: string) {
    super(`${champ}: ${message}`);
  }
}

export function verifTexte(
  valeur: any,
  champ: string,
  opts: { min?: number; max?: number; requis?: boolean } = {}
): string {
  const { min = 0, max = 10000, requis = true } = opts;
  if (valeur === undefined || valeur === null || valeur === '') {
    if (requis) throw new ErreurValidation(champ, 'requis');
    return '';
  }
  if (typeof valeur !== 'string') throw new ErreurValidation(champ, 'doit être un texte');
  const v = valeur.trim();
  if (v.length < min) throw new ErreurValidation(champ, `min ${min} caractères`);
  if (v.length > max) throw new ErreurValidation(champ, `max ${max} caractères`);
  return v;
}

export function verifUuid(valeur: any, champ: string): string {
  if (typeof valeur !== 'string') throw new ErreurValidation(champ, 'invalide');
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!regex.test(valeur)) throw new ErreurValidation(champ, 'UUID invalide');
  return valeur;
}

export function verifEntier(
  valeur: any,
  champ: string,
  opts: { min?: number; max?: number } = {}
): number {
  const n = Number(valeur);
  if (!Number.isInteger(n)) throw new ErreurValidation(champ, 'doit être un entier');
  if (opts.min !== undefined && n < opts.min) throw new ErreurValidation(champ, `min ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new ErreurValidation(champ, `max ${opts.max}`);
  return n;
}

export function verifEnum<T extends string>(valeur: any, champ: string, valeurs: readonly T[]): T {
  if (!valeurs.includes(valeur as T)) {
    throw new ErreurValidation(champ, `doit être parmi ${valeurs.join(', ')}`);
  }
  return valeur as T;
}

export function verifDate(valeur: any, champ: string): Date {
  if (!valeur) throw new ErreurValidation(champ, 'requis');
  const d = new Date(valeur);
  if (isNaN(d.getTime())) throw new ErreurValidation(champ, 'date invalide');
  return d;
}

// Nettoie pour éviter XSS basique dans les affichages (complément à React qui échappe déjà)
export function nettoyer(texte: string): string {
  return texte
    .replace(/[<>]/g, '') // retire les balises pures
    .trim();
}

// Tailles max fichiers
export const TAILLES_MAX = {
  document: 10 * 1024 * 1024,      // 10 Mo
  image: 5 * 1024 * 1024,          // 5 Mo
  piece_jointe: 20 * 1024 * 1024,  // 20 Mo
};

// Types MIME autorisés
export const TYPES_MIME = {
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg'],
  images: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
};

export function verifFichier(
  fichier: File,
  champ: string,
  opts: { tailleMax?: number; typesAutorises?: string[] } = {}
): File {
  if (!fichier) throw new ErreurValidation(champ, 'fichier requis');
  const { tailleMax = TAILLES_MAX.document, typesAutorises = TYPES_MIME.documents } = opts;
  if (fichier.size > tailleMax) {
    throw new ErreurValidation(champ, `fichier trop lourd (max ${Math.round(tailleMax / 1024 / 1024)} Mo)`);
  }
  if (!typesAutorises.includes(fichier.type)) {
    throw new ErreurValidation(champ, 'type de fichier non autorisé');
  }
  // Protection nom
  const nomSur = fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  if (!nomSur) throw new ErreurValidation(champ, 'nom de fichier invalide');
  return fichier;
}

// Nettoie un nom de fichier pour le stockage
export function nomFichierSecurise(nom: string): string {
  return nom
    .replace(/\.\./g, '')           // pas de ../
    .replace(/[\/\\]/g, '_')         // pas de / ni \
    .replace(/[^a-zA-Z0-9._-]/g, '_') // seulement caractères sûrs
    .slice(0, 200);
}
