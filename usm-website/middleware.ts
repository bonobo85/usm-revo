import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;

    // Compte désactivé → déconnexion forcée
    if (token && token.is_active === false) {
      const url = new URL('/login?erreur=desactive', req.url);
      return NextResponse.redirect(url);
    }

    // Vérifier que le token n'est pas trop vieux (> 1h) pour forcer refresh
    // Le JWT NextAuth contient déjà `iat` (issued at)
    if (token && token.iat) {
      const age = Date.now() / 1000 - token.iat;
      // Si > 1h, on pourrait forcer un refresh, mais NextAuth le fait déjà automatiquement
      // On ajoute juste une protection si le JWT semble manipulé
      if (age < 0 || age > 60 * 60 * 24 * 31) {
        const url = new URL('/login?erreur=session_invalide', req.url);
        return NextResponse.redirect(url);
      }
    }

    const res = NextResponse.next();
    // Header anti-cache pour pages privées
    res.headers.set('Cache-Control', 'private, no-store, must-revalidate');
    return res;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && token.is_active !== false,
    },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/personnel/:path*',
    '/entrainement/:path*',
    '/badges/:path*',
    '/crash/:path*',
    '/formateurs/:path*',
    '/rapports/:path*',
    '/sanctions/:path*',
    '/demandes/:path*',
    '/archives/:path*',
    '/documents/:path*',
    '/historique/:path*',
    '/admin/:path*',
    '/profil/:path*',
    '/api/upload/:path*',
    '/api/archiver/:path*',
    '/api/rang/:path*',
    '/api/sanctions/:path*',
  ],
};
