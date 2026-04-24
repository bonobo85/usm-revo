# USM — United States Marshal

Site web officiel de l'unité USM (GTA RP).

## Stack

- **Frontend** : Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Auth** : Discord OAuth2 via NextAuth.js
- **Icons** : Lucide React
- **PDF** : jsPDF + jspdf-autotable

## Installation locale

```bash
npm install
cp .env.local.example .env.local
# remplir les variables d'env (voir DEPLOIEMENT.md)
npm run dev
```

Ouvrir http://localhost:3000

## Structure

```
/app              → Pages Next.js (App Router)
  /api            → API routes (auth, upload, archiver)
  /dashboard      → Dashboard temps réel
  /personnel      → Annuaire + statuts + organigramme
  /entrainement   → Planning + résultats
  /badges         → Attribution badges
  /crash          → Unité CRASH (badge requis)
  /formateurs     → Questionnaires + évaluations
  /rapports       → Création + validation
  /sanctions      → Sanctions
  /demandes       → Demandes internes
  /archives       → Anciens membres
  /documents      → Bibliothèque
  /historique     → Journal audit
  /admin          → Admin panel
  /profil/[id]    → Profil membre
  /login          → Login Discord

/components       → Sidebar, Header, RankBadge, Modal, Tabs, ...
/lib              → supabase, auth, permissions, navigation, utils, pdf, discord, audit
/hooks            → useUser, useSupabase
/types            → Types TypeScript
/supabase         → Migrations SQL
/public/logos     → Logos USM + BCSO (SVG)
```

## Rangs (hiérarchie)

| Level | Nom             | Couleur |
|-------|-----------------|---------|
| 9     | Shériff         | Or      |
| 8     | Leader          | Rouge   |
| 7     | Co-Leader       | Orange  |
| 6     | Opérateur       | Violet  |
| 5     | Opérateur Second| Violet  |
| 4     | Formateur       | Bleu    |
| 3     | USM Confirmé    | Vert    |
| 2     | USM             | Gris    |
| 1     | BCSO            | Gris    |

## Fonctionnalités clés

- 🔐 **Auth Discord OAuth2** avec sync auto Supabase
- 🛡️ **RLS strictes** + anti-escalade de rang
- 🔔 **Notifications temps réel** (Supabase Realtime)
- 📣 **Webhooks Discord** (promotions, rapports, sanctions)
- 📄 **Export PDF** (rapports, évaluations, feuilles de présence)
- 📂 **Storage Supabase** pour documents et pièces jointes
- 📊 **Audit trail complet** de toutes les actions

Voir `DEPLOIEMENT.md` pour les étapes complètes de mise en production.
