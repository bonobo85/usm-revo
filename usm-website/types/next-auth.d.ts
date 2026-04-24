import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      discord_id: string;
      username: string;
      avatar_url: string | null;
      rank_level: number;
      rank_nom: string;
      permissions: string[];
      is_active: boolean;
    };
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user_id: string;
    discord_id: string;
    rank_level: number;
    rank_nom: string;
    permissions: string[];
    is_active: boolean;
    access_token?: string;
  }
}
