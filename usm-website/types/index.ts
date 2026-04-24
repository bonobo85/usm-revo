// Types utilisés partout dans l'app USM

export type Rang = {
  id: number;
  level: number;
  nom: string;
  couleur: string;
  icone: string | null;
  description: string | null;
};

export type Utilisateur = {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  email: string | null;
  rank_level: number;
  statut: 'disponible' | 'occupe' | 'absent' | 'hors_ligne';
  date_entree: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UtilisateurAvecRang = Utilisateur & {
  rang?: Rang;
  badges?: BadgeAttribue[];
  permissions?: string[];
};

export type Badge = {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  couleur: string;
  icone: string | null;
};

export type BadgeAttribue = {
  id: string;
  user_id: string;
  badge_id: number;
  attribue_par: string | null;
  attribue_le: string;
  revoque_par: string | null;
  revoque_le: string | null;
  raison_revocation: string | null;
  is_active: boolean;
  badge?: Badge;
};

export type SessionEntrainement = {
  id: string;
  titre: string;
  description: string | null;
  date_session: string;
  lieu: string | null;
  rank_min: number;
  createur_id: string;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  created_at: string;
};

export type ResultatEntrainement = {
  id: string;
  session_id: string;
  user_id: string;
  present: boolean;
  score: number | null;
  commentaire: string | null;
};

export type Investigation = {
  id: string;
  titre: string;
  description: string | null;
  responsable_id: string;
  statut: 'ouverte' | 'en_cours' | 'classee';
  conclusion: string | null;
  date_cloture: string | null;
  created_at: string;
};

export type Questionnaire = {
  id: string;
  titre: string;
  description: string | null;
  createur_id: string;
  is_active: boolean;
  created_at: string;
};

export type Question = {
  id: string;
  questionnaire_id: string;
  ordre: number;
  type: 'text' | 'qcm' | 'boolean';
  question: string;
  options: string[] | null;
  bonne_reponse: string | null;
  points: number;
};

export type Evaluation = {
  id: string;
  candidat_id: string;
  formateur_id: string;
  questionnaire_id: string;
  date_planifiee: string | null;
  date_passee: string | null;
  statut: 'planifiee' | 'en_cours' | 'reussie' | 'echouee' | 'annulee';
  score_obtenu: number | null;
  score_total: number | null;
  commentaire: string | null;
};

export type Rapport = {
  id: string;
  type: 'enquete' | 'gav' | 'bracelet' | 'incident';
  titre: string;
  contenu: Record<string, any>;
  auteur_id: string;
  statut: 'draft' | 'submitted' | 'validated' | 'rejected';
  validateur_id: string | null;
  date_validation: string | null;
  commentaire_validation: string | null;
  created_at: string;
  updated_at: string;
};

export type Sanction = {
  id: string;
  user_id: string;
  type: 'avertissement' | 'blame' | 'suspension';
  raison: string;
  duree_jours: number | null;
  date_debut: string;
  date_fin: string | null;
  createur_id: string;
  valide_par: string | null;
  is_active: boolean;
  created_at: string;
};

export type Demande = {
  id: string;
  type: 'badge' | 'rang' | 'conge';
  demandeur_id: string;
  contenu: Record<string, any>;
  justification: string | null;
  statut: 'en_attente' | 'approuve' | 'refuse' | 'annule';
  traite_par: string | null;
  date_traitement: string | null;
  commentaire_traitement: string | null;
  created_at: string;
};

export type Document = {
  id: string;
  titre: string;
  categorie: 'officiel' | 'template' | 'formation';
  url: string;
  nom_fichier: string | null;
  rank_min: number;
  upload_par: string | null;
  description: string | null;
  created_at: string;
};

export type Archive = {
  id: string;
  user_id: string;
  username_final: string;
  rank_final: number | null;
  date_entree: string | null;
  date_depart: string;
  raison: 'demission' | 'exclusion' | 'inactivite' | 'autre';
  notes: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  titre: string;
  message: string | null;
  lien: string | null;
  read_at: string | null;
  created_at: string;
};

export type LogAudit = {
  id: string;
  acteur_id: string | null;
  action: string;
  cible_type: string | null;
  cible_id: string | null;
  cible_user_id: string | null;
  avant: any;
  apres: any;
  ip: string | null;
  created_at: string;
  acteur?: Utilisateur;
  cible?: Utilisateur;
};
