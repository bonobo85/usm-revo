// Envoi de messages Discord via webhook
import { COULEURS_RANGS } from './permissions';

type Embed = {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
};

function hexEnInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export async function envoyerWebhook(
  url: string | undefined,
  contenu: { content?: string; embeds?: Embed[] }
) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contenu),
    });
  } catch (e) {
    console.error('Erreur webhook Discord:', e);
  }
}

export async function notifNouveauMembre(user: { username: string; avatar_url?: string | null }) {
  await envoyerWebhook(process.env.DISCORD_WEBHOOK_URL, {
    embeds: [
      {
        title: '🎖️ Nouveau membre',
        description: `**${user.username}** vient de rejoindre l'unité USM`,
        color: hexEnInt(COULEURS_RANGS[1]),
        thumbnail: user.avatar_url ? { url: user.avatar_url } : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: 'USM — U.S. Marshal' },
      },
    ],
  });
}

export async function notifPromotion(
  user: { username: string; avatar_url?: string | null },
  ancienRang: number,
  nouveauRang: number,
  nomsRangs: Record<number, string>
) {
  const promotion = nouveauRang > ancienRang;
  await envoyerWebhook(process.env.DISCORD_WEBHOOK_PROMOTIONS, {
    embeds: [
      {
        title: promotion ? '⬆️ Promotion' : '⬇️ Rétrogradation',
        description: `**${user.username}** : ${nomsRangs[ancienRang]} → **${nomsRangs[nouveauRang]}**`,
        color: hexEnInt(COULEURS_RANGS[nouveauRang] || '#1E40AF'),
        thumbnail: user.avatar_url ? { url: user.avatar_url } : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: 'USM — U.S. Marshal' },
      },
    ],
  });
}

export async function notifRapportValide(
  rapport: { titre: string; type: string; id: string },
  auteur: { username: string; avatar_url?: string | null }
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  await envoyerWebhook(process.env.DISCORD_WEBHOOK_RAPPORTS, {
    embeds: [
      {
        title: '✅ Rapport validé',
        description: `Rapport *${rapport.titre}* (${rapport.type}) validé`,
        color: hexEnInt('#10B981'),
        url: `${siteUrl}/rapports/${rapport.id}`,
        fields: [{ name: 'Auteur', value: auteur.username, inline: true }],
        thumbnail: auteur.avatar_url ? { url: auteur.avatar_url } : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: 'USM — Rapports' },
      },
    ],
  });
}

export async function notifSanctionGrave(
  sanction: { type: string; raison: string; duree_jours?: number | null },
  user: { username: string; avatar_url?: string | null }
) {
  if (sanction.type === 'avertissement') return;
  await envoyerWebhook(process.env.DISCORD_WEBHOOK_SANCTIONS, {
    embeds: [
      {
        title: `⚠️ Sanction : ${sanction.type}`,
        description: `**${user.username}**`,
        color: hexEnInt('#DC2626'),
        fields: [
          { name: 'Raison', value: sanction.raison },
          ...(sanction.duree_jours
            ? [{ name: 'Durée', value: `${sanction.duree_jours} jours`, inline: true }]
            : []),
        ],
        thumbnail: user.avatar_url ? { url: user.avatar_url } : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: 'USM — Sanctions' },
      },
    ],
  });
}

export async function notifEntrainementPlanifie(session: {
  titre: string;
  date_session: string;
  lieu?: string | null;
}) {
  await envoyerWebhook(process.env.DISCORD_WEBHOOK_ENTRAINEMENTS, {
    embeds: [
      {
        title: '📅 Nouvel entraînement',
        description: session.titre,
        color: hexEnInt('#3B82F6'),
        fields: [
          { name: 'Date', value: new Date(session.date_session).toLocaleString('fr-FR'), inline: true },
          ...(session.lieu ? [{ name: 'Lieu', value: session.lieu, inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'USM — Entraînements' },
      },
    ],
  });
}
