import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Award,
  Siren,
  BookOpen,
  FileText,
  Archive,
  Shield,
  FolderOpen,
  History,
  Settings,
  MoreHorizontal,
  MessageSquare,
} from 'lucide-react';
import { peutVoirCrash, peutVoirFormateurs } from './permissions';

export type LienNav = {
  href: string;
  label: string;
  icone: any;
  rangMin: number;
  permission?: string;
  badgeRequis?: string;
  // Filtre custom : recoit rang + badges
  visible?: (rang: number, badges: string[]) => boolean;
  // Apparait dans le dropdown "Plus" plutot que la nav principale
  dansPlus?: boolean;
};

export const liensNavigation: LienNav[] = [
  // Nav principale
  { href: '/dashboard', label: 'Dashboard', icone: LayoutDashboard, rangMin: 1 },
  { href: '/personnel', label: 'Personnel', icone: Users, rangMin: 1 },
  { href: '/entrainement', label: 'Entra\u00EEnement', icone: GraduationCap, rangMin: 1 },
  {
    href: '/formateurs',
    label: 'Formateurs',
    icone: BookOpen,
    rangMin: 1,
    visible: (r, b) => peutVoirFormateurs(r, b),
  },
  {
    href: '/badges',
    label: 'Badges',
    icone: Award,
    rangMin: 5,
  },
  {
    href: '/crash',
    label: 'CRASH',
    icone: Siren,
    rangMin: 1,
    visible: (r, b) => peutVoirCrash(r, b),
  },

  // Dropdown "Plus"
  { href: '/rapports', label: 'Rapports', icone: FileText, rangMin: 1, dansPlus: true },
  { href: '/sanctions', label: 'Retour & Sanction', icone: MessageSquare, rangMin: 5, dansPlus: true },
  { href: '/documents', label: 'Documents', icone: FolderOpen, rangMin: 1, dansPlus: true },
  { href: '/historique', label: 'Historique', icone: History, rangMin: 1, dansPlus: true },
  { href: '/archives', label: 'Archives', icone: Archive, rangMin: 6, dansPlus: true },
  { href: '/admin', label: 'Admin', icone: Settings, rangMin: 7, dansPlus: true },
];

export function liensVisibles(rang: number, badges: string[]): LienNav[] {
  return liensNavigation.filter((l) => {
    if (rang < l.rangMin) return false;
    if (l.visible && !l.visible(rang, badges)) return false;
    return true;
  });
}

export function liensPrincipaux(rang: number, badges: string[]): LienNav[] {
  return liensVisibles(rang, badges).filter((l) => !l.dansPlus);
}

export function liensPlus(rang: number, badges: string[]): LienNav[] {
  return liensVisibles(rang, badges).filter((l) => l.dansPlus);
}

export function titrePage(pathname: string): string {
  const lien = liensNavigation.find((l) =>
    pathname === l.href || pathname.startsWith(l.href + '/')
  );
  if (lien) return lien.label;
  if (pathname.startsWith('/profil')) return 'Profil';
  return 'USM';
}
