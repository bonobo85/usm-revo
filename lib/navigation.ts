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
  Inbox,
  FolderOpen,
  History,
  Settings,
} from 'lucide-react';

export type LienNav = {
  href: string;
  label: string;
  icone: any;
  rangMin: number;
  permission?: string;
  badgeRequis?: string;
};

export const liensNavigation: LienNav[] = [
  { href: '/dashboard', label: 'Dashboard', icone: LayoutDashboard, rangMin: 1 },
  { href: '/personnel', label: 'Personnel', icone: Users, rangMin: 1 },
  { href: '/entrainement', label: 'Entraînement', icone: GraduationCap, rangMin: 1 },
  { href: '/badges', label: 'Badges', icone: Award, rangMin: 1 },
  { href: '/crash', label: 'CRASH', icone: Siren, rangMin: 6, badgeRequis: 'CRASH' },
  { href: '/formateurs', label: 'Formateurs', icone: BookOpen, rangMin: 4 },
  { href: '/rapports', label: 'Rapports', icone: FileText, rangMin: 1 },
  { href: '/sanctions', label: 'Sanctions', icone: Shield, rangMin: 1 },
  { href: '/demandes', label: 'Demandes', icone: Inbox, rangMin: 1 },
  { href: '/archives', label: 'Archives', icone: Archive, rangMin: 6 },
  { href: '/documents', label: 'Documents', icone: FolderOpen, rangMin: 1 },
  { href: '/historique', label: 'Historique', icone: History, rangMin: 1 },
  { href: '/admin', label: 'Admin Panel', icone: Settings, rangMin: 7 },
];

export function titrePage(pathname: string): string {
  const lien = liensNavigation.find((l) =>
    pathname === l.href || pathname.startsWith(l.href + '/')
  );
  if (lien) return lien.label;
  if (pathname.startsWith('/profil')) return 'Profil';
  return 'USM';
}
