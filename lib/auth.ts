import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase';
import { notifNouveauMembre } from './discord';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email' } },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 jours (au lieu de 30)
    updateAge: 60 * 60, // Refresh toutes les heures
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },

  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== 'discord') return false;
      if (!account.providerAccountId) return false;

      const admin = supabaseAdmin();

      const discord_id = account.providerAccountId;
      const username = (profile as any)?.username || user.name || 'Inconnu';
      const email = user.email || null;
      const avatar = (profile as any)?.avatar
        ? `https://cdn.discordapp.com/avatars/${discord_id}/${(profile as any).avatar}.png`
        : null;

      try {
        const { data: existant } = await admin
          .from('users')
          .select('id, is_active')
          .eq('discord_id', discord_id)
          .maybeSingle();

        if (!existant) {
          const { data: nouveau, error } = await admin
            .from('users')
            .insert({
              discord_id,
              username,
              email,
              avatar_url: avatar,
              rank_level: 1,
              statut: 'disponible',
            })
            .select('id')
            .single();

          if (error) {
            console.error('Erreur création user:', error);
            return false;
          }

          // Audit + webhook
          await admin.from('audit_logs').insert({
            acteur_id: nouveau.id,
            action: 'inscription',
            cible_user_id: nouveau.id,
          });
          await notifNouveauMembre({ username, avatar_url: avatar });
        } else {
          // Compte désactivé → refus
          if (!existant.is_active) return false;

          await admin
            .from('users')
            .update({ username, email, avatar_url: avatar, statut: 'disponible' })
            .eq('discord_id', discord_id);

          await admin.from('audit_logs').insert({
            acteur_id: existant.id,
            action: 'connexion',
            cible_user_id: existant.id,
          });
        }

        return true;
      } catch (e) {
        console.error('Erreur signIn:', e);
        return false;
      }
    },

    async jwt({ token, account }) {
      const admin = supabaseAdmin();
      const discord_id = account?.providerAccountId || (token as any).discord_id;
      if (!discord_id) return token;

      try {
        const { data: u } = await admin
          .from('users')
          .select('id, discord_id, username, avatar_url, rank_level, is_active, ranks(nom)')
          .eq('discord_id', discord_id)
          .maybeSingle();

        if (!u) {
          return { ...token, is_active: false } as any;
        }

        // Compte désactivé → invalide la session
        if (!u.is_active) {
          return { ...token, is_active: false } as any;
        }

        const { data: perms } = await admin
          .from('user_permissions')
          .select('permission')
          .eq('user_id', u.id)
          .is('deleted_at', null);

        token.user_id = u.id;
        token.discord_id = u.discord_id;
        (token as any).username = u.username;
        (token as any).avatar_url = u.avatar_url;
        token.rank_level = u.rank_level;
        token.rank_nom = (u.ranks as any)?.nom || 'BCSO';
        token.permissions = perms?.map((p) => p.permission) || [];
        token.is_active = u.is_active;

        // JWT custom pour Supabase RLS
        const supabaseJwt = jwt.sign(
          {
            sub: u.id,
            user_id: u.id,
            rank_level: u.rank_level,
            aud: 'authenticated',
            role: 'authenticated',
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2h
          },
          process.env.NEXTAUTH_SECRET!
        );
        token.access_token = supabaseJwt;

        return token;
      } catch (e) {
        console.error('Erreur jwt callback:', e);
        return { ...token, is_active: false } as any;
      }
    },

    async session({ session, token }) {
      if (!(token as any).is_active) {
        return { ...session, user: null } as any;
      }
      session.user = {
        id: token.user_id,
        discord_id: token.discord_id,
        username: (token as any).username,
        avatar_url: (token as any).avatar_url,
        rank_level: token.rank_level,
        rank_nom: token.rank_nom,
        permissions: token.permissions || [],
        is_active: token.is_active,
      };
      session.accessToken = token.access_token;
      return session;
    },
  },

  events: {
    async signOut({ token }) {
      if ((token as any)?.user_id) {
        const admin = supabaseAdmin();
        await admin.from('users').update({ statut: 'hors_ligne' }).eq('id', (token as any).user_id);
      }
    },
  },
};
