// Synchronisation avec la guilde Discord (bot token)
// Utilise les roles Discord pour determiner le rang si mappe.

import { supabaseAdmin } from './supabase';

const DISCORD_API = 'https://discord.com/api/v10';

type GuildMember = {
  user?: { id: string; username: string; global_name?: string; avatar?: string | null };
  nick?: string | null;
  roles: string[];
  joined_at: string;
};

type RoleToRank = Record<string, number>;

/**
 * Map des roles Discord vers rank_level USM.
 * Configurer via env var DISCORD_ROLE_MAP (JSON) : {"role_id": rank_level}
 * Exemple : {"1234567890": 9, "0987654321": 8}
 */
function getRoleMap(): RoleToRank {
  try {
    return JSON.parse(process.env.DISCORD_ROLE_MAP || '{}');
  } catch {
    return {};
  }
}

async function discordFetch(path: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN manquant');
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Discord API ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Recupere un membre de la guilde et determine son rang via ses roles.
 * Retourne null si pas dans la guilde.
 */
export async function getGuildMember(discordId: string): Promise<{
  nick: string | null;
  avatar_url: string | null;
  rank_level: number | null;
  roles: string[];
} | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;
  try {
    const m: GuildMember = await discordFetch(`/guilds/${guildId}/members/${discordId}`);
    const roleMap = getRoleMap();
    // Prend le rang le plus eleve parmi les roles mappes
    let rank: number | null = null;
    for (const roleId of m.roles) {
      const r = roleMap[roleId];
      if (r && (rank === null || r > rank)) rank = r;
    }
    const avatarHash = m.user?.avatar;
    const avatar_url = avatarHash
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`
      : null;
    return {
      nick: m.nick || m.user?.global_name || m.user?.username || null,
      avatar_url,
      rank_level: rank,
      roles: m.roles,
    };
  } catch (e) {
    console.warn('getGuildMember:', (e as Error).message);
    return null;
  }
}

/**
 * Sync un user a son login : met a jour rank (si mapping fourni), avatar, surnom suggere.
 */
export async function syncUserFromGuild(userId: string, discordId: string) {
  const guildInfo = await getGuildMember(discordId);
  if (!guildInfo) return;

  const admin = supabaseAdmin();
  const updates: Record<string, any> = {};

  if (guildInfo.avatar_url) updates.avatar_url = guildInfo.avatar_url;

  // Si pas de surnom defini et qu'on a un nick Discord, on pre-remplit
  const { data: existing } = await admin
    .from('users')
    .select('surnom, rank_level')
    .eq('id', userId)
    .maybeSingle();

  if (existing && !existing.surnom && guildInfo.nick) {
    updates.surnom = guildInfo.nick;
  }

  // Applique le rang seulement s'il est plus eleve (anti-degradation involontaire)
  if (guildInfo.rank_level && existing && guildInfo.rank_level > (existing.rank_level || 0)) {
    updates.rank_level = guildInfo.rank_level;
  }

  updates.derniere_connexion = new Date().toISOString();

  if (Object.keys(updates).length > 0) {
    await admin.from('users').update(updates).eq('id', userId);
  }
}

/**
 * Import en masse : importe tous les membres de la guilde dans users.
 * A appeler depuis un bouton admin panel.
 */
export async function importGuildMembers(): Promise<{ crees: number; maj: number; total: number }> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('DISCORD_GUILD_ID manquant');

  const admin = supabaseAdmin();
  const roleMap = getRoleMap();

  // Pagination Discord : 1000 max par page
  let after = '0';
  let all: GuildMember[] = [];
  for (let i = 0; i < 20; i++) {
    const batch: GuildMember[] = await discordFetch(
      `/guilds/${guildId}/members?limit=1000&after=${after}`
    );
    if (!batch.length) break;
    all = all.concat(batch);
    after = batch[batch.length - 1].user!.id;
    if (batch.length < 1000) break;
  }

  let crees = 0;
  let maj = 0;

  for (const m of all) {
    if (!m.user || m.user.id.startsWith('000000')) continue;
    const discord_id = m.user.id;
    const username = m.user.global_name || m.user.username || 'Inconnu';
    const avatar_url = m.user.avatar
      ? `https://cdn.discordapp.com/avatars/${discord_id}/${m.user.avatar}.png`
      : null;

    let rank_level = 1;
    for (const roleId of m.roles) {
      const r = roleMap[roleId];
      if (r && r > rank_level) rank_level = r;
    }

    const { data: existing } = await admin
      .from('users')
      .select('id, rank_level, surnom')
      .eq('discord_id', discord_id)
      .maybeSingle();

    if (!existing) {
      await admin.from('users').insert({
        discord_id,
        username,
        avatar_url,
        rank_level,
        surnom: m.nick || null,
        statut: 'hors_ligne',
        is_active: true,
        date_entree: m.joined_at,
      });
      crees++;
    } else {
      const updates: Record<string, any> = { username, avatar_url };
      if (rank_level > (existing.rank_level || 0)) updates.rank_level = rank_level;
      if (!existing.surnom && m.nick) updates.surnom = m.nick;
      await admin.from('users').update(updates).eq('id', existing.id);
      maj++;
    }
  }

  return { crees, maj, total: all.length };
}
