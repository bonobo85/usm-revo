'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { liensNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { RankBadge } from './RankBadge';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const pathname = usePathname();
  const { user, hasRang } = useUser();
  const [menuMobile, setMenuMobile] = useState(false);
  const [menuProfil, setMenuProfil] = useState(false);
  const [menuPlus, setMenuPlus] = useState(false);
  const refProfil = useRef<HTMLDivElement>(null);
  const refPlus = useRef<HTMLDivElement>(null);

  // Ferme les menus au clic extérieur
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (refProfil.current && !refProfil.current.contains(e.target as Node)) setMenuProfil(false);
      if (refPlus.current && !refPlus.current.contains(e.target as Node)) setMenuPlus(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Ferme le menu mobile au changement de page
  useEffect(() => {
    setMenuMobile(false);
    setMenuPlus(false);
    setMenuProfil(false);
  }, [pathname]);

  const liensVisibles = liensNavigation.filter((l) => hasRang(l.rangMin));
  // Sur desktop, on affiche les 6 premiers + un "Plus ▼"
  const liensPrincipaux = liensVisibles.slice(0, 6);
  const liensSupp = liensVisibles.slice(6);

  return (
    <>
      <nav className="sticky top-0 z-40 bg-fond-clair border-b border-gris-bordure">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <Image src="/logos/usm.png" alt="USM" width={40} height={40} />
              <div className="hidden sm:block">
                <p className="text-white font-bold text-sm leading-tight">UNITED STATES</p>
                <p className="text-or font-bold text-xs leading-tight">MARSHAL</p>
              </div>
            </Link>

            {/* Liens desktop */}
            <div className="hidden xl:flex items-center gap-1 flex-1 justify-center">
              {liensPrincipaux.map((lien) => {
                const actif = pathname === lien.href || pathname.startsWith(lien.href + '/');
                const Icone = lien.icone;
                return (
                  <Link
                    key={lien.href}
                    href={lien.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      actif
                        ? 'bg-bleu/20 text-bleu-clair'
                        : 'text-gray-300 hover:bg-fond-carte hover:text-white'
                    )}
                  >
                    <Icone size={16} />
                    <span>{lien.label}</span>
                  </Link>
                );
              })}

              {/* Menu "Plus" pour les liens supplémentaires */}
              {liensSupp.length > 0 && (
                <div className="relative" ref={refPlus}>
                  <button
                    onClick={() => setMenuPlus(!menuPlus)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      liensSupp.some((l) => pathname === l.href || pathname.startsWith(l.href + '/'))
                        ? 'bg-bleu/20 text-bleu-clair'
                        : 'text-gray-300 hover:bg-fond-carte hover:text-white'
                    )}
                  >
                    Plus <ChevronDown size={14} className={menuPlus ? 'rotate-180' : ''} />
                  </button>
                  {menuPlus && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-fond-carte border border-gris-bordure rounded-lg shadow-xl py-1">
                      {liensSupp.map((lien) => {
                        const actif = pathname === lien.href || pathname.startsWith(lien.href + '/');
                        const Icone = lien.icone;
                        return (
                          <Link
                            key={lien.href}
                            href={lien.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                              actif ? 'text-bleu-clair bg-bleu/10' : 'text-gray-300 hover:bg-fond-clair hover:text-white'
                            )}
                          >
                            <Icone size={16} />
                            <span>{lien.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions droite */}
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />

              {/* Menu profil desktop */}
              {user && (
                <div className="relative hidden sm:block" ref={refProfil}>
                  <button
                    onClick={() => setMenuProfil(!menuProfil)}
                    className="flex items-center gap-2 p-1 pr-2 hover:bg-fond-carte rounded-md transition-colors"
                  >
                    <Avatar src={user.avatar_url} nom={user.username} taille={32} />
                    <div className="hidden md:block text-left">
                      <p className="text-white text-xs font-medium leading-tight">{user.username}</p>
                      <p className="text-texte-gris text-xs leading-tight">{user.rank_nom}</p>
                    </div>
                    <ChevronDown size={14} className={cn('text-texte-gris transition-transform', menuProfil && 'rotate-180')} />
                  </button>

                  {menuProfil && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-fond-carte border border-gris-bordure rounded-lg shadow-xl overflow-hidden">
                      <div className="p-3 border-b border-gris-bordure">
                        <div className="flex items-center gap-3">
                          <Avatar src={user.avatar_url} nom={user.username} taille={40} />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{user.username}</p>
                            <div className="mt-1">
                              <RankBadge rang={user.rank_level} taille="sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/profil/${user.id}`}
                        className="block px-3 py-2 text-sm text-gray-300 hover:bg-fond-clair hover:text-white"
                      >
                        Mon profil
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 border-t border-gris-bordure"
                      >
                        <LogOut size={14} />
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Hamburger mobile */}
              <button
                onClick={() => setMenuMobile(true)}
                className="xl:hidden p-2 text-gray-300 hover:text-white hover:bg-fond-carte rounded-md"
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menu mobile plein écran */}
      {menuMobile && (
        <div className="xl:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMenuMobile(false)} />

          <aside className="relative w-80 max-w-[85vw] bg-fond-clair border-r border-gris-bordure flex flex-col ml-auto">
            <div className="p-4 border-b border-gris-bordure flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image src="/logos/usm.png" alt="USM" width={36} height={36} />
                <div>
                  <p className="text-white font-bold text-sm leading-tight">USM</p>
                  <p className="text-or text-xs">U.S. Marshal</p>
                </div>
              </div>
              <button onClick={() => setMenuMobile(false)} className="text-gray-300 hover:text-white p-1">
                <X size={22} />
              </button>
            </div>

            {user && (
              <Link
                href={`/profil/${user.id}`}
                className="p-4 border-b border-gris-bordure flex items-center gap-3 hover:bg-fond-carte"
              >
                <Avatar src={user.avatar_url} nom={user.username} taille={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.username}</p>
                  <RankBadge rang={user.rank_level} taille="sm" />
                </div>
              </Link>
            )}

            <nav className="flex-1 overflow-y-auto p-2">
              {liensVisibles.map((lien) => {
                const actif = pathname === lien.href || pathname.startsWith(lien.href + '/');
                const Icone = lien.icone;
                return (
                  <Link
                    key={lien.href}
                    href={lien.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md mb-1 text-sm transition-colors',
                      actif ? 'bg-bleu/20 text-bleu-clair' : 'text-gray-300 hover:bg-fond-carte hover:text-white'
                    )}
                  >
                    <Icone size={18} />
                    <span>{lien.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logo BCSO */}
            <div className="p-3 border-t border-gris-bordure">
              <div className="flex justify-center mb-3">
                <Image src="/logos/bcso.png" alt="BCSO" width={56} height={56} className="opacity-50" />
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-md"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
